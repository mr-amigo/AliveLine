import re

from app.domain.estimation.base import Estimate, clamp_hours

# First match wins, so more specific kinds come first.
_RULES: list[tuple[str, tuple[str, ...], float]] = [
    ("project", ("project", "курсов", "проєкт", "проект"), 10),
    ("exam prep", ("exam", "midterm", "final", "test", "іспит", "екзамен", "контрольн"), 6),
    ("essay", ("essay", "есе", "реферат"), 5),
    ("report/lab", ("report", "lab", "звіт", "лаб"), 4),
    ("homework", ("homework", "problem set", "hw", "assignment", "домашн", "завдання"), 3),
    ("quiz", ("quiz", "тест-квіз", "квіз"), 1),
]
_DEFAULT_KIND, _DEFAULT_HOURS = "task", 3.0
_WORDS_PER_EXTRA_HOUR = 150
_MAX_EXTRA_HOURS = 4.0


def _match(text: str) -> tuple[str, float] | None:
    lowered = text.lower()
    for name, keywords, hours in _RULES:
        if any(re.search(rf"\b{re.escape(k)}", lowered) for k in keywords):
            return name, hours
    return None


class HeuristicEstimator:
    """Keyword-based fallback: base hours per assignment kind plus a bit for long descriptions."""

    def estimate(self, title: str, description: str = "", course: str | None = None) -> Estimate:
        # The title names the kind of work; the description only decides when the title says nothing
        # (otherwise "Lab 3: ... write tests" would count as exam prep).
        kind, base = _match(title) or _match(description) or (_DEFAULT_KIND, _DEFAULT_HOURS)
        words = len(description.split())
        extra = min(words / _WORDS_PER_EXTRA_HOUR, _MAX_EXTRA_HOURS)
        hours = clamp_hours(base + extra)
        rationale = f"Typical {kind} takes about {base:g} h"
        if extra >= 0.5:
            rationale += f", plus about {extra:.1f} h for a {words}-word description"
        return Estimate(hours=hours, rationale=rationale + ".", source="heuristic")
