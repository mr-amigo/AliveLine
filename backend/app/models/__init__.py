"""SQLAlchemy entities. Import every model here so Base.metadata knows all tables."""
from app.models.user import LoginEvent, User
from app.models.waitlist import WaitlistEntry

__all__ = ["User", "LoginEvent", "WaitlistEntry"]
