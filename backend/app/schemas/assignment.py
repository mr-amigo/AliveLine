from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.domain.planner import Status
from app.schemas.common import UtcDatetime


class EstimateIn(BaseModel):
    """An estimate produced elsewhere (the AI Lambda) and passed through by the client."""

    hours: float = Field(ge=0.5, le=100)
    rationale: str = Field(default="", max_length=500)
    source: Literal["ai", "heuristic"] = "ai"


def _aware(value: datetime | None) -> datetime | None:
    # A deadline without an offset is taken as UTC (the frontend always sends ISO with Z).
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class AssignmentCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=10_000)
    course_name: str | None = Field(default=None, max_length=100)
    deadline: datetime
    user_hours: float | None = Field(default=None, ge=0.5, le=100)
    estimate: EstimateIn | None = None

    _deadline_aware = field_validator("deadline")(_aware)


class AssignmentUpdate(BaseModel):
    """Partial update. `user_hours: null` clears the correction; `course_name: ""` removes the course."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=10_000)
    course_name: str | None = Field(default=None, max_length=100)
    deadline: datetime | None = None
    user_hours: float | None = Field(default=None, ge=0.5, le=100)
    done: bool | None = None
    estimate: EstimateIn | None = None

    _deadline_aware = field_validator("deadline")(_aware)


class WindowOut(BaseModel):
    start_date: date
    target_finish: date
    status: Status
    unscheduled_hours: float


class AssignmentOut(BaseModel):
    id: int
    title: str
    description: str
    course_name: str | None
    deadline: UtcDatetime
    source: str
    ai_hours: float | None
    ai_rationale: str | None
    estimate_source: str | None
    user_hours: float | None
    effective_hours: float
    done: bool
    window: WindowOut


class DayItem(BaseModel):
    assignment_id: int
    title: str
    course_name: str | None
    hours: float
    status: Status


class DayOut(BaseModel):
    date: date
    items: list[DayItem]


class PlanOut(BaseModel):
    today: date
    capacity: float
    today_items: list[DayItem]
    days: list[DayOut]
    assignments: list[AssignmentOut]
