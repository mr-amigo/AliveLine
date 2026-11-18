from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import current_user, get_db, get_estimator
from app.domain.estimation import Estimator
from app.models import User
from app.schemas.assignment import AssignmentCreate, AssignmentOut, AssignmentUpdate
from app.services.assignment_service import AssignmentNotFoundError, AssignmentService
from app.services.plan_service import assignment_out

router = APIRouter(prefix="/assignments", tags=["assignments"])


def _service(
    user: User = Depends(current_user), db: Session = Depends(get_db), estimator: Estimator = Depends(get_estimator)
) -> AssignmentService:
    return AssignmentService(db, user, estimator)


def _not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")


@router.post("", response_model=AssignmentOut, status_code=status.HTTP_201_CREATED)
def create_assignment(data: AssignmentCreate, svc: AssignmentService = Depends(_service)) -> AssignmentOut:
    a = svc.create(data)
    return assignment_out(svc.db, svc.user, a)


@router.patch("/{assignment_id}", response_model=AssignmentOut)
def update_assignment(
    assignment_id: int, data: AssignmentUpdate, svc: AssignmentService = Depends(_service)
) -> AssignmentOut:
    try:
        a = svc.update(assignment_id, data)
    except AssignmentNotFoundError:
        raise _not_found()
    return assignment_out(svc.db, svc.user, a)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assignment(assignment_id: int, svc: AssignmentService = Depends(_service)) -> Response:
    try:
        svc.delete(assignment_id)
    except AssignmentNotFoundError:
        raise _not_found()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
