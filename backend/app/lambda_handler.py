"""AWS Lambda entry point: HTTP requests from the function URL (via CloudFront), plus a `migrate` action.

`make aws-migrate` invokes the function directly with {"action": "migrate"} to create tables;
function URL events never carry a top-level "action". Lifespan is off: a cold start must not
block on Aurora resuming from pause.
"""

from typing import Any

from mangum import Mangum

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.db import Base, engine
from app.main import app

http_handler = Mangum(app, lifespan="off")


def migrate() -> dict[str, str]:
    Base.metadata.create_all(engine)
    return {"status": "migrated"}


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if event.get("action") == "migrate":
        return migrate()
    return http_handler(event, context)
