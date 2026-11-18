"""Free vs Pro rules. Pure: no FastAPI/SQLAlchemy.

Free keeps the core product forever (deadlines, import, planner, one AI estimate per assignment, with a
monthly fair-use cap). Extra AI features are Pro, each with a few lifetime trial uses on Free.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum


class Feature(str, Enum):
    ESTIMATE = "estimate"  # first AI estimate of an assignment (core, free)
    REESTIMATE = "reestimate"  # asking AI again for an assignment it already estimated
    STEPS = "steps"  # AI split into ordered steps
    BULK = "bulk"  # "Estimate all with AI"


#: Lifetime trial uses on Free for each Pro feature.
TRIALS: dict[Feature, int] = {Feature.REESTIMATE: 3, Feature.STEPS: 3, Feature.BULK: 3}
#: AI estimate calls per calendar month (fair use; Pro only guards against runaway scripts).
MONTHLY_AI = {"free": 100, "pro": 1000}
#: Paddle retries failed renewals for a few days; keep Pro meanwhile.
GRACE = timedelta(days=3)
#: Paddle subscription statuses that keep Pro on.
PRO_STATUSES = frozenset({"active", "trialing", "past_due"})


class LimitReached(Exception):
    """A Free user has no trial uses left (`pro_required`) or the monthly AI cap is hit."""

    def __init__(self, message: str, pro_required: bool) -> None:
        super().__init__(message)
        self.pro_required = pro_required


@dataclass
class Usage:
    """Mutable usage counters of one user, as stored on the account."""

    trial_uses: dict[str, int]
    ai_month: str | None
    ai_month_count: int


def is_pro(plan: str, plan_until: datetime | None, now: datetime) -> bool:
    return plan == "pro" and (plan_until is None or plan_until + GRACE > now)


def month_key(now: datetime) -> str:
    return now.strftime("%Y-%m")


def trials_left(trial_uses: dict[str, int]) -> dict[str, int]:
    return {f.value: max(0, n - trial_uses.get(f.value, 0)) for f, n in TRIALS.items()}


def ai_used_this_month(usage: Usage, now: datetime) -> int:
    return usage.ai_month_count if usage.ai_month == month_key(now) else 0


def consume(usage: Usage, feature: Feature, ai_calls: int, pro: bool, now: datetime) -> None:
    """Checks the limits for one use of `feature` making `ai_calls` AI requests, then counts it.

    Raises LimitReached without changing anything when it is not allowed.
    """
    if not pro and feature in TRIALS and trials_left(usage.trial_uses)[feature.value] == 0:
        raise LimitReached("You've used the free tries of this feature. Upgrade to Pro to keep using it.", True)
    cap = MONTHLY_AI["pro" if pro else "free"]
    used = ai_used_this_month(usage, now)
    if used + ai_calls > cap:
        raise LimitReached(
            f"Monthly AI limit reached ({cap} estimates). It resets on the 1st."
            + ("" if pro else " Pro raises it."),
            not pro,
        )
    if not pro and feature in TRIALS:
        usage.trial_uses = {**usage.trial_uses, feature.value: usage.trial_uses.get(feature.value, 0) + 1}
    usage.ai_month = month_key(now)
    usage.ai_month_count = used + ai_calls


def subscription_plan(status: str, period_end: datetime | None) -> tuple[str, datetime | None]:
    """(plan, plan_until) for a Paddle subscription status."""
    if status in PRO_STATUSES:
        return "pro", period_end
    return "free", None
