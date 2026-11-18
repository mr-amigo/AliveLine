from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import current_user, get_db
from app.models import User
from app.schemas.assignment import PlanOut
from app.services.plan_service import MAX_RANGE_DAYS, build_plan

router = APIRouter(prefix="/plan", tags=["plan"])


@router.get("", response_model=PlanOut)
def get_plan(
    start: date | None = Query(default=None, alias="from", description="First day; default Monday of this week"),
    days: int = Query(default=7, ge=1, le=MAX_RANGE_DAYS),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PlanOut:
    return build_plan(db, user, start, days)
