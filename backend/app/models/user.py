from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, utcnow


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    daily_capacity_hours: Mapped[float] = mapped_column(Float, default=3.0)
    buffer_days: Mapped[int] = mapped_column(Integer, default=1)
    # Planner v2 (§4 v2). server_default so `add_missing_columns` can add them to existing tables.
    weekday_hours: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)  # Mon..Sun
    max_session_hours: Mapped[float] = mapped_column(Float, default=2.0, server_default=text("2.0"))
    min_session_hours: Mapped[float] = mapped_column(Float, default=1.5, server_default=text("1.5"))
    interleave: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    login_events: Mapped[list["LoginEvent"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class LoginEvent(Base):
    """One row per sign-in/sign-up; used to measure returning users (logins on distinct days)."""

    __tablename__ = "login_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="login_events")
