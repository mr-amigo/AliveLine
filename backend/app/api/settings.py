from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import current_user, get_db
from app.models import User
from app.schemas.auth import SettingsUpdate, UserOut
from app.services.user_service import update_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.patch("", response_model=UserOut)
def patch_settings(
    data: SettingsUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> User:
    return update_settings(db, user, data)
