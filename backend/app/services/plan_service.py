"""Builds the user's plan on read: loads assignments, runs the planner, shapes DTOs."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.domain.planner import Plan, PlanItem, PlanSettings, WorkWindow, WorkWindowPlanner
from app.models import Assignment, User
from app.schemas.assignment import AssignmentOut, DayItem, DayOut, PlanOut, WindowOut

MAX_RANGE_DAYS = 31


def _tz() -> ZoneInfo:
    return ZoneInfo(get_settings().app_tz)


def local_today() -> date:
    return datetime.now(_tz()).date()


def local_date(value: datetime) -> date:
    if value.tzinfo is None:  # SQLite returns naive UTC
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(_tz()).date()


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def load_assignments(db: Session, user: User) -> list[Assignment]:
    return list(
        db.scalars(select(Assignment).where(Assignment.user_id == user.id).order_by(Assignment.deadline, Assignment.id))
    )


def plan_settings(user: User) -> PlanSettings:
    return PlanSettings(
        capacity=user.daily_capacity_hours,
        buffer_days=user.buffer_days,
        weekday_hours=tuple(user.weekday_hours) if user.weekday_hours else None,
        max_session_hours=user.max_session_hours,
        min_session_hours=user.min_session_hours,
        interleave=user.interleave,
    )


def compute_plan(user: User, assignments: list[Assignment], today: date) -> Plan:
    items = [PlanItem(a.id, local_date(a.deadline), a.effective_hours(), a.done) for a in assignments]
    return WorkWindowPlanner().plan(items, plan_settings(user), today)


def to_out(a: Assignment, window: WorkWindow) -> AssignmentOut:
    return AssignmentOut(
        id=a.id,
        title=a.title,
        description=a.description,
        course_name=a.course_name,
        deadline=a.deadline,
        source=a.source,
        ai_hours=a.ai_hours,
        ai_rationale=a.ai_rationale,
        estimate_source=a.estimate_source,
        user_hours=a.user_hours,
        effective_hours=a.effective_hours(),
        done=a.done,
        window=WindowOut(**window.__dict__),
    )


def assignment_out(db: Session, user: User, assignment: Assignment) -> AssignmentOut:
    """One assignment with its window, which depends on all the user's other assignments."""
    plan = compute_plan(user, load_assignments(db, user), local_today())
    return to_out(assignment, plan.windows[assignment.id])


def build_plan(
    db: Session, user: User, start: date | None = None, days: int = 7, today: date | None = None
) -> PlanOut:
    today = today or local_today()
    start = start or monday_of(today)
    days = max(1, min(days, MAX_RANGE_DAYS))
    assignments = load_assignments(db, user)
    plan = compute_plan(user, assignments, today)
    settings = plan_settings(user)
    by_id = {a.id: a for a in assignments}

    def items_on(day: date) -> list[DayItem]:
        return [
            DayItem(
                assignment_id=aid,
                title=by_id[aid].title,
                course_name=by_id[aid].course_name,
                hours=hours,
                status=plan.windows[aid].status,
            )
            for aid, hours in plan.on(day)
        ]

    return PlanOut(
        today=today,
        capacity=user.daily_capacity_hours,
        today_items=items_on(today),
        days=[
            DayOut(date=day, capacity=settings.hours_on(day), items=items_on(day))
            for day in (start + timedelta(days=i) for i in range(days))
        ],
        assignments=[to_out(a, plan.windows[a.id]) for a in assignments],
    )
