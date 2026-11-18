from sqlalchemy.orm import Session

from app.models import User
from app.schemas.auth import SettingsUpdate

NULLABLE = {"weekday_hours"}  # null resets to "same hours every day"


def update_settings(db: Session, user: User, data: SettingsUpdate) -> User:
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is None and field not in NULLABLE:
            continue
        setattr(user, field, value)
    db.commit()
    return user
