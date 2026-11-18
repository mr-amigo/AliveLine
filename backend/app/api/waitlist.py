from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.schemas.waitlist import WaitlistIn
from app.services.waitlist_service import join_waitlist

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", status_code=status.HTTP_201_CREATED)
def join(data: WaitlistIn, db: Session = Depends(get_db)) -> Response:
    join_waitlist(db, data.email)
    return Response(status_code=status.HTTP_201_CREATED)
