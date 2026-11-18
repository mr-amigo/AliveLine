from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import WaitlistEntry


def join_waitlist(db: Session, email: str) -> None:
    """Idempotent: joining twice with the same email is not an error."""
    email = email.lower()
    if db.scalar(select(WaitlistEntry).where(WaitlistEntry.email == email)) is None:
        db.add(WaitlistEntry(email=email))
        db.commit()
