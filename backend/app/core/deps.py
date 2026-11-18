from collections.abc import Iterator
from functools import lru_cache

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import decode_access_token, decode_claim
from app.domain.estimation import (
    Estimator,
    HeuristicEstimator,
    NoStepSplitter,
    OpenAIEstimator,
    OpenAIStepSplitter,
    StepSplitter,
)
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


def ai_claim(scope: str):  # type: ignore[no-untyped-def]
    """Dependency factory: the caller must hold a fresh `X-AI-Claim` for `scope`, issued by /api/billing/claim
    to this same user (the AI Lambda can't count usage itself: no DB)."""

    def check(request: Request) -> int:
        user_id = current_user_id(request)
        claim = decode_claim(request.headers.get("x-ai-claim", ""), "ai")
        if claim is None or claim.get("sub") != str(user_id) or claim.get("scope") != scope:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "AI permission missing or expired, try again")
        return user_id

    return check


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user = db.get(User, current_user_id(request))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


@lru_cache
def _openai_client():  # type: ignore[no-untyped-def]
    s = get_settings()
    if not s.openai_api_key:
        return None
    from openai import OpenAI

    return OpenAI(api_key=s.openai_api_key, base_url=s.openai_base_url, timeout=s.llm_timeout_seconds, max_retries=1)


def _configured_estimator() -> Estimator:
    client = _openai_client()
    return OpenAIEstimator(client, get_settings().openai_model) if client else HeuristicEstimator()


def get_estimator() -> Estimator:
    """Estimator strategy chosen by config. Overridable in tests."""
    return _configured_estimator()


def get_step_splitter() -> StepSplitter:
    """AI step splitter, or one that never splits when no LLM is configured. Overridable in tests."""
    client = _openai_client()
    return OpenAIStepSplitter(client, get_settings().openai_model) if client else NoStepSplitter()
