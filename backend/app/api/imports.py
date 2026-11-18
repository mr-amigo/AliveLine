from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import current_user, get_db
from app.domain.importers import IcsSource, InvalidSourceError
from app.models import User
from app.schemas.imports import ImportOut
from app.services.import_service import ImportService

router = APIRouter(prefix="/import", tags=["import"])

MAX_BYTES = 1_000_000


@router.post("/ics", response_model=ImportOut)
async def import_ics(
    file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ImportOut:
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is larger than 1 MB")
    if not data.strip():
        raise HTTPException(422, "The file is empty")
    try:
        result = ImportService(db, user).run(IcsSource(ZoneInfo(get_settings().app_tz)), data, kind="ics")
    except InvalidSourceError as exc:
        raise HTTPException(422, str(exc))
    return ImportOut(**result.__dict__)
