from dataclasses import dataclass
from typing import Literal, Protocol

EstimateSource = Literal["ai", "heuristic"]

MIN_HOURS = 0.5
MAX_HOURS = 40.0


@dataclass(frozen=True)
class Estimate:
    hours: float
    rationale: str
    source: EstimateSource


class Estimator(Protocol):
    def estimate(self, title: str, description: str = "", course: str | None = None) -> Estimate: ...


def clamp_hours(hours: float) -> float:
    """Clamp to the allowed range and round to the nearest 0.5 h."""
    return round(min(max(hours, MIN_HOURS), MAX_HOURS) * 2) / 2
