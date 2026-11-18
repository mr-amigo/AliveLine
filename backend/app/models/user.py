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
    suggest_steps: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    #: Planner shows the "won't fit in time" summary.
    show_at_risk: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    # Billing (Paddle) + usage limits (domain/billing.py).
    plan: Mapped[str] = mapped_column(String(10), default="free", server_default=text("'free'"))
    plan_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paddle_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    paddle_subscription_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    paddle_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    #: occurred_at of the last applied Paddle event: older (out-of-order) events are ignored.
    billing_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_uses: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)
    ai_month: Mapped[str | None] = mapped_column(String(7), nullable=True)
    ai_month_count: Mapped[int] = mapped_column(Integer, default=0, server_default=text("0"))
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
