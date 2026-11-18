from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, utcnow
from app.models.course import Course
from app.models.step import Step

DEFAULT_HOURS = 3.0


class Assignment(Base):
    __tablename__ = "assignments"
    # Imports dedupe on (user, external uid); NULL uids (manual items) never collide.
    __table_args__ = (UniqueConstraint("user_id", "external_uid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(10), default="manual")  # manual | ics | moodle
    external_uid: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ai_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_rationale: Mapped[str | None] = mapped_column(String(500), nullable=True)
    estimate_source: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ai | heuristic
    user_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    course: Mapped[Course | None] = relationship(lazy="joined")
    steps: Mapped[list[Step]] = relationship(
        order_by=Step.position, cascade="all, delete-orphan", lazy="selectin", passive_deletes=True
    )

    @property
    def course_name(self) -> str | None:
        return self.course.name if self.course else None

    def effective_hours(self) -> float:
        """Hours still to plan: open steps if split, else the student's correction, else the estimate."""
        if self.steps:
            return sum(s.hours for s in self.steps if not s.done)
        if self.user_hours is not None:
            return self.user_hours
        return self.ai_hours if self.ai_hours is not None else DEFAULT_HOURS
