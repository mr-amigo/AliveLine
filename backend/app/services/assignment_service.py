from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.estimation import Estimate, Estimator
from app.models import Assignment, Course, User
from app.schemas.assignment import AssignmentCreate, AssignmentUpdate, EstimateIn


class AssignmentNotFoundError(Exception):
    pass


class AssignmentService:
    """CRUD use cases for one user's assignments. Every query is scoped to that user."""

    def __init__(self, db: Session, user: User, estimator: Estimator) -> None:
        self.db = db
        self.user = user
        self.estimator = estimator

    def get(self, assignment_id: int) -> Assignment:
        a = self.db.scalar(
            select(Assignment).where(Assignment.id == assignment_id, Assignment.user_id == self.user.id)
        )
        if a is None:
            raise AssignmentNotFoundError
        return a

    def create(self, data: AssignmentCreate) -> Assignment:
        a = Assignment(
            user_id=self.user.id,
            title=data.title,
            description=data.description,
            deadline=data.deadline,
            user_hours=data.user_hours,
            course=self._course(data.course_name),
        )
        self._apply_estimate(a, data.estimate)
        self.db.add(a)
        self.db.commit()
        return a

    def update(self, assignment_id: int, data: AssignmentUpdate) -> Assignment:
        a = self.get(assignment_id)
        fields = data.model_dump(exclude_unset=True)
        for name in ("title", "description", "deadline", "done"):
            if fields.get(name) is not None:
                setattr(a, name, fields[name])
        if "user_hours" in fields:
            a.user_hours = fields["user_hours"]  # None clears the correction
        if "course_name" in fields:
            a.course = self._course(fields["course_name"])
        if data.estimate is not None:
            self._apply_estimate(a, data.estimate)
        elif a.estimate_source == "heuristic" and ({"title", "description"} & fields.keys()):
            self._apply_estimate(a, None)  # keep the server estimate in sync with the text
        self.db.commit()
        return a

    def delete(self, assignment_id: int) -> None:
        self.db.delete(self.get(assignment_id))
        self.db.commit()

    def _apply_estimate(self, a: Assignment, given: EstimateIn | None) -> None:
        if given is not None:
            est = Estimate(hours=given.hours, rationale=given.rationale, source=given.source)
        else:
            est = self.estimator.estimate(a.title, a.description or "", a.course_name)
        a.ai_hours, a.ai_rationale, a.estimate_source = est.hours, est.rationale[:500], est.source

    def _course(self, name: str | None) -> Course | None:
        if not name:
            return None
        course = self.db.scalar(select(Course).where(Course.user_id == self.user.id, Course.name == name))
        if course is None:
            course = Course(user_id=self.user.id, name=name)
            self.db.add(course)
        return course
