"""Upserts drafts from an AssignmentSource into the user's assignments."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.estimation import HeuristicEstimator
from app.domain.importers import AssignmentDraft, AssignmentSource
from app.models import Assignment, User
from app.services.assignment_service import AssignmentService

SKIP_OLDER_THAN = timedelta(days=30)


@dataclass
class ImportResult:
    created: int = 0
    updated: int = 0
    skipped: int = 0
    created_ids: list[int] = field(default_factory=list)


class ImportService:
    """New drafts → assignments with a heuristic estimate (AI runs later from the client, per item).
    Known drafts (same external uid) → only deadline/description/course refresh; the student's
    corrections (user_hours, done, estimates) are kept."""

    def __init__(self, db: Session, user: User) -> None:
        self.db = db
        self.user = user
        self.assignments = AssignmentService(db, user, HeuristicEstimator())

    def run(self, source: AssignmentSource, data: bytes, kind: str, now: datetime | None = None) -> ImportResult:
        now = now or datetime.now(timezone.utc)
        drafts = source.parse(data)
        existing = self._existing({d.external_uid for d in drafts if d.external_uid})
        result = ImportResult()
        created: list[Assignment] = []
        seen: set[str] = set()

        for draft in drafts:
            uid = draft.external_uid or ""
            if draft.deadline < now - SKIP_OLDER_THAN or uid in seen:
                result.skipped += 1
                continue
            seen.add(uid)
            if uid in existing:
                self._refresh(existing[uid], draft)
                result.updated += 1
            else:
                created.append(self._create(draft, kind))

        self.db.commit()
        result.created = len(created)
        result.created_ids = [a.id for a in created]
        return result

    def _existing(self, uids: set[str]) -> dict[str, Assignment]:
        if not uids:
            return {}
        rows = self.db.scalars(
            select(Assignment).where(Assignment.user_id == self.user.id, Assignment.external_uid.in_(uids))
        )
        return {a.external_uid: a for a in rows if a.external_uid}

    def _refresh(self, a: Assignment, draft: AssignmentDraft) -> None:
        a.deadline = draft.deadline
        if draft.description:
            a.description = draft.description
        if draft.course:
            a.course = self.assignments.course(draft.course)

    def _create(self, draft: AssignmentDraft, kind: str) -> Assignment:
        a = Assignment(
            user_id=self.user.id,
            title=draft.title,
            description=draft.description,
            deadline=draft.deadline,
            source=kind,
            external_uid=draft.external_uid,
            course=self.assignments.course(draft.course),
        )
        self.assignments.apply_estimate(a, None)
        self.db.add(a)
        self.db.flush()
        return a
