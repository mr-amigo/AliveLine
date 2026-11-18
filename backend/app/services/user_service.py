from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import SettingsUpdate


def update_settings(db: Session, user: User, data: SettingsUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    return user
