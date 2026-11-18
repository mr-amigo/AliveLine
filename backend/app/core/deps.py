from collections.abc import Iterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import decode_access_token
from app.domain.estimation import Estimator, HeuristicEstimator
from app.models import User


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(get_settings().cookie_name)
    user_id = decode_access_token(token) if token else None
    user = db.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


def get_estimator() -> Estimator:
    """Server-side estimator. The backend Lambda has no route to Bedrock, so it is the heuristic;
    AI estimates arrive from the client (see docs/PLAN.md §5). Overridable in tests."""
    return HeuristicEstimator()
