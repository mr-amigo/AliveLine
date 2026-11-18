from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import current_user, get_db
from app.core.security import create_access_token
from app.models import User
from app.schemas.auth import SignInIn, SignUpIn, UserOut
from app.services.auth_service import AuthService, EmailTakenError, InvalidCredentialsError

router = APIRouter(prefix="/auth", tags=["auth"])


def _set_session_cookie(response: Response, user_id: int) -> None:
    settings = get_settings()
    response.set_cookie(
        settings.cookie_name,
        create_access_token(user_id),
        max_age=settings.jwt_expire_days * 24 * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
    )


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(data: SignUpIn, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        user = AuthService(db).sign_up(data)
    except EmailTakenError:
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    _set_session_cookie(response, user.id)
    return user


@router.post("/signin", response_model=UserOut)
def signin(data: SignInIn, response: Response, db: Session = Depends(get_db)) -> User:
    try:
        user = AuthService(db).sign_in(data.email, data.password)
    except InvalidCredentialsError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    _set_session_cookie(response, user.id)
    return user


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def signout() -> Response:
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(get_settings().cookie_name, path="/")
    return response


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> User:
    return user
