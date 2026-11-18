"""AWS Lambda entry point: HTTP requests from the function URL (via CloudFront), plus ops actions.

`make aws-migrate` invokes the function directly with {"action": "migrate"} to create tables,
`make aws-stats` with {"action": "stats"} to read product metrics (Aurora is private);
function URL events never carry a top-level "action". Lifespan is off: a cold start must not
block on Aurora resuming from pause.
"""

from typing import Any

from mangum import Mangum
from sqlalchemy import select

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.db import Base, SessionLocal, add_missing_columns, engine
from app.main import app
from app.models import User
from app.services.stats_service import compute_stats

http_handler = Mangum(app, lifespan="off")


def migrate() -> dict[str, Any]:
    Base.metadata.create_all(engine)
    return {"status": "migrated", "added_columns": add_missing_columns(engine)}


def stats() -> dict[str, int]:
    with SessionLocal() as db:
        return compute_stats(db)


def delete_user(email: str) -> dict[str, Any]:
    """Ops cleanup (e.g. leftover test accounts); cascades to the user's data."""
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email.strip().lower()))
        if user is None:
            return {"deleted": False}
        db.delete(user)
        db.commit()
        return {"deleted": True}


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if event.get("action") == "migrate":
        return migrate()
    if event.get("action") == "stats":
        return stats()
    if event.get("action") == "delete_user":
        return delete_user(event["email"])
    return http_handler(event, context)
