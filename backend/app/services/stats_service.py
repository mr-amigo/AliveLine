"""Product metrics for `make aws-stats`: waitlist size, users, returning users."""

from collections import defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Assignment, LoginEvent, User, WaitlistEntry


def _local_day(at: datetime, tz: ZoneInfo) -> date:
    if at.tzinfo is None:  # SQLite drops tz; stored values are UTC
        at = at.replace(tzinfo=timezone.utc)
    return at.astimezone(tz).date()


def compute_stats(db: Session) -> dict[str, int]:
    """Returning user = signed in on at least 2 distinct calendar days (APP_TZ)."""
    tz = ZoneInfo(get_settings().app_tz)
    days: dict[int, set[date]] = defaultdict(set)
    for user_id, at in db.execute(select(LoginEvent.user_id, LoginEvent.at)):
        days[user_id].add(_local_day(at, tz))
    return {
        "waitlist": db.scalar(select(func.count()).select_from(WaitlistEntry)) or 0,
        "users": db.scalar(select(func.count()).select_from(User)) or 0,
        "returning_users": sum(1 for d in days.values() if len(d) >= 2),
        "assignments": db.scalar(select(func.count()).select_from(Assignment)) or 0,
    }
