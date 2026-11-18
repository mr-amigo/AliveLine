from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import utcnow
from app.core.security import hash_password, verify_password
from app.models import LoginEvent, User
from app.schemas.auth import SignUpIn


class EmailTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class AuthService:
    """Sign-up / sign-in use cases. Token handling lives in the API layer (cookies are HTTP concerns)."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def sign_up(self, data: SignUpIn) -> User:
        email = data.email.lower()
        if self._find(email) is not None:
            raise EmailTakenError
        user = User(email=email, name=data.name, password_hash=hash_password(data.password))
        self.db.add(user)
        self.db.flush()
        self._record_login(user)
        return user

    def sign_in(self, email: str, password: str) -> User:
        user = self._find(email.lower())
        if user is None or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError
        self._record_login(user)
        return user

    def _find(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def _record_login(self, user: User) -> None:
        now = utcnow()
        user.last_login_at = now
        self.db.add(LoginEvent(user_id=user.id, at=now))
        self.db.commit()
