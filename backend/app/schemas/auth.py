from typing import Annotated

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import UtcDatetime


class SignUpIn(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)


class SignInIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    name: str
    daily_capacity_hours: float
    buffer_days: int
    weekday_hours: list[float] | None
    max_session_hours: float
    min_session_hours: float
    interleave: bool
    created_at: UtcDatetime


class SettingsUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=100)
    daily_capacity_hours: float | None = Field(default=None, ge=0.5, le=12)
    buffer_days: int | None = Field(default=None, ge=0, le=7)
    # Mon..Sun hours; 0 = day off; explicit null → every day uses daily_capacity_hours.
    weekday_hours: list[Annotated[float, Field(ge=0, le=12, multiple_of=0.5)]] | None = Field(
        default=None, min_length=7, max_length=7
    )
    max_session_hours: float | None = Field(default=None, ge=0.5, le=8, multiple_of=0.5)
    min_session_hours: float | None = Field(default=None, ge=0.5, le=4, multiple_of=0.5)
    interleave: bool | None = None

    @field_validator("weekday_hours")
    @classmethod
    def _some_study_day(cls, v: list[float] | None) -> list[float] | None:
        if v is not None and not any(v):
            raise ValueError("at least one day needs study hours")
        return v
