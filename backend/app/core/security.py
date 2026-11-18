from datetime import timedelta

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.db import utcnow

_ALGORITHM = "HS256"


def _encode(password: str) -> bytes:
    return password.encode("utf-8")[:72]  # bcrypt only uses the first 72 bytes


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=get_settings().bcrypt_rounds)
    return bcrypt.hashpw(_encode(password), salt).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(_encode(password), password_hash.encode())
    except ValueError:
        return False


def create_access_token(user_id: int) -> str:
    settings = get_settings()
    payload = {"sub": str(user_id), "exp": utcnow() + timedelta(days=settings.jwt_expire_days)}
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def create_claim(user_id: int, audience: str, minutes: int, **extra: str) -> str:
    """Short-lived signed permission the backend hands out for the AI Lambda (no DB there)."""
    payload = {"sub": str(user_id), "aud": audience, "exp": utcnow() + timedelta(minutes=minutes), **extra}
    return jwt.encode(payload, get_settings().secret_key, algorithm=_ALGORITHM)


def decode_claim(token: str, audience: str) -> dict[str, str] | None:
    try:
        return jwt.decode(token, get_settings().secret_key, algorithms=[_ALGORITHM], audience=audience)
    except jwt.PyJWTError:
        return None
