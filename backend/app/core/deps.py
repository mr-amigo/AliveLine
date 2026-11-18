from collections.abc import Iterator
from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import decode_access_token
from app.domain.estimation import Estimator, HeuristicEstimator, OpenAIEstimator
from app.models import User


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user_id(request: Request) -> int:
    """Auth without a DB round-trip (AI Lambda): a valid, unexpired session cookie is enough."""
    token = request.cookies.get(get_settings().cookie_name)
    user_id = decode_access_token(token) if token else None
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user_id


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = db.get(User, current_user_id(request))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


@lru_cache
def _configured_estimator() -> Estimator:
    s = get_settings()
    if s.openai_api_key:
        from openai import OpenAI

        client = OpenAI(api_key=s.openai_api_key, base_url=s.openai_base_url, timeout=s.llm_timeout_seconds, max_retries=1)
        return OpenAIEstimator(client, s.openai_model)
    return HeuristicEstimator()


def get_estimator() -> Estimator:
    """Estimator strategy chosen by config (docs/PLAN.md §5). Overridable in tests."""
    return _configured_estimator()
