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


class HeuristicEstimator:
    """Keyword-based fallback: base hours per assignment kind plus a bit for long descriptions."""

    def estimate(self, title: str, description: str = "", course: str | None = None) -> Estimate:
        text = f"{title} {description}".lower()
        kind, base = _DEFAULT_KIND, _DEFAULT_HOURS
        for name, keywords, hours in _RULES:
            if any(re.search(rf"\b{re.escape(k)}", text) for k in keywords):
                kind, base = name, hours
                break
        words = len(description.split())
        extra = min(words / _WORDS_PER_EXTRA_HOUR, _MAX_EXTRA_HOURS)
        hours = clamp_hours(base + extra)
        rationale = f"Typical {kind} takes about {base:g} h"
        if extra >= 0.5:
            rationale += f", plus about {extra:.1f} h for a {words}-word description"
        return Estimate(hours=hours, rationale=rationale + ".", source="heuristic")
