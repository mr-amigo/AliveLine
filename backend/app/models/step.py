from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class Step(Base):
    """An ordered part of an assignment (e.g. research → code → report). Planned in order (PLAN §4 v2)."""

    __tablename__ = "steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    assignment_id: Mapped[int] = mapped_column(ForeignKey("assignments.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    hours: Mapped[float] = mapped_column(Float)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)  # "order" is an SQL keyword
