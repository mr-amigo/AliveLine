from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


class InvalidSourceError(ValueError):
    """The input can't be read as this source's format."""


@dataclass(frozen=True)
class AssignmentDraft:
    title: str
    deadline: datetime  # timezone-aware
    description: str = ""
    course: str | None = None
    external_uid: str | None = None


class AssignmentSource(Protocol):
    def parse(self, data: bytes) -> list[AssignmentDraft]: ...
