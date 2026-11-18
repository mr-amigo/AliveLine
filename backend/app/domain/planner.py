"""Work-window planning: backward, as-late-as-possible scheduling of hours across all open assignments.

Pure domain logic (no FastAPI/SQLAlchemy). See docs/PLAN.md §4.
"""

import math
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import StrEnum


class Status(StrEnum):
    CAN_WAIT = "can_wait"
    TIME_TO_START = "time_to_start"
    CRITICAL = "critical"
    DONE = "done"


@dataclass(frozen=True)
class PlanItem:
    id: int
    deadline: date  # calendar day in the user's time zone
    hours: float
    done: bool = False


@dataclass(frozen=True)
class WorkWindow:
    start_date: date
    target_finish: date
    status: Status
    unscheduled_hours: float = 0.0


@dataclass(frozen=True)
class Plan:
    windows: dict[int, WorkWindow]
    daily: dict[date, list[tuple[int, float]]] = field(default_factory=dict)

    def on(self, day: date) -> list[tuple[int, float]]:
        return self.daily.get(day, [])


def round_up_half(hours: float) -> float:
    """Round hours up to the next 0.5 (planning granularity)."""
    return math.ceil(hours * 2 - 1e-9) / 2


class WorkWindowPlanner:
    """Allocates each item's hours backward from its target finish, latest target first.

    Processing the latest target first and filling days as late as possible (mirror of EDF) means
    earlier deadlines get pushed earlier only when days are already taken, which is optimal for
    "does everything fit before its deadline".
    """

    def plan(self, items: list[PlanItem], capacity: float, buffer_days: int, today: date) -> Plan:
        windows: dict[int, WorkWindow] = {}
        daily: dict[date, list[tuple[int, float]]] = {}

        open_items: list[tuple[PlanItem, date]] = []
        for item in items:
            if item.done:
                windows[item.id] = WorkWindow(item.deadline, item.deadline, Status.DONE)
            else:
                open_items.append((item, self._target_finish(item.deadline, buffer_days, today)))

        if not open_items:
            return Plan(windows, daily)

        last_day = max(target for _, target in open_items)
        free = {today + timedelta(days=i): capacity for i in range((last_day - today).days + 1)}

        for item, target in sorted(open_items, key=lambda it: (it[1], it[0].deadline, it[0].id), reverse=True):
            remaining = round_up_half(item.hours)
            allocated: list[date] = []
            day = target
            while remaining > 0 and day >= today:
                take = min(free.get(day, 0.0), remaining)
                if take > 0:
                    free[day] -= take
                    remaining -= take
                    allocated.append(day)
                    daily.setdefault(day, []).append((item.id, take))
                day -= timedelta(days=1)

            start = min(allocated) if allocated else today
            windows[item.id] = WorkWindow(
                start_date=start,
                target_finish=target,
                status=self._status(item.deadline, start, remaining, today),
                unscheduled_hours=round(remaining, 2),
            )

        for allocations in daily.values():
            allocations.sort(key=lambda a: a[0])
        return Plan(windows, daily)

    @staticmethod
    def _target_finish(deadline: date, buffer_days: int, today: date) -> date:
        if deadline < today:
            return deadline  # overdue: nothing can be scheduled
        return max(today, deadline - timedelta(days=buffer_days))

    @staticmethod
    def _status(deadline: date, start: date, unscheduled: float, today: date) -> Status:
        if unscheduled > 0 or deadline < today or (deadline - today).days <= 1:
            return Status.CRITICAL
        if start <= today + timedelta(days=1):
            return Status.TIME_TO_START
        return Status.CAN_WAIT
