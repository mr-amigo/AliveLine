"""Work-window planning: as-late-as-possible scheduling of hours across all open assignments.

Pure domain logic (no FastAPI/SQLAlchemy). See docs/PLAN.md §4 and §4 v2.
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
class PlanSettings:
    """The user's planning preferences (all editable in Settings)."""

    capacity: float = 3.0  # hours per day
    buffer_days: int = 1
    weekday_hours: tuple[float, ...] | None = None  # Mon..Sun; None → `capacity` every day
    max_session_hours: float = 2.0  # preferred max of one task per day (soft)
    min_session_hours: float = 1.5  # no smaller pieces unless the task is smaller or a deadline forces it
    interleave: bool = True  # False → no session cap: one task may fill a whole day

    def hours_on(self, day: date) -> float:
        return self.weekday_hours[day.weekday()] if self.weekday_hours else self.capacity


@dataclass(frozen=True)
class WorkWindow:
    start_date: date
    target_finish: date
    status: Status
    at_risk: bool = False  # can't be finished before the deadline
    shortfall_hours: float = 0.0  # hours of it that don't fit


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
    """Places each item's hours as late as possible before its target finish, earliest target first.

    Earliest-first: an item fits iff the free hours up to its target cover it (earlier items only use days up
    to their own targets). Under overload the urgent items keep the days next to their targets (incl. today);
    an item that can't fit takes what is left in its window and is `at_risk` with `shortfall_hours`.
    Sessions (soft): sweep 1 takes at most `max_session_hours` per day, so big tasks spread over days and days
    mix tasks; sweep 2 drops the cap; sweep 3 drops the minimum piece size. Sweeps 1–2 never leave a piece
    under `min_session_hours` (a 3 h task becomes 1.5 + 1.5, a 2.5 h task stays whole); later sweeps run only
    when the deadline needs them.
    """

    def plan(self, items: list[PlanItem], settings: PlanSettings, today: date) -> Plan:
        windows: dict[int, WorkWindow] = {}
        daily: dict[date, list[tuple[int, float]]] = {}

        open_items: list[tuple[PlanItem, date]] = []
        for item in items:
            if item.done:
                windows[item.id] = WorkWindow(item.deadline, item.deadline, Status.DONE)
            else:
                open_items.append((item, self._target_finish(item.deadline, settings.buffer_days, today)))
        if not open_items:
            return Plan(windows, daily)

        last_day = max(target for _, target in open_items)
        free = {
            today + timedelta(days=i): settings.hours_on(today + timedelta(days=i))
            for i in range((last_day - today).days + 1)
        }
        cap = settings.max_session_hours if settings.interleave else math.inf
        min_piece = min(settings.min_session_hours, cap)
        order = sorted(open_items, key=lambda it: (it[1], it[0].deadline, it[0].id))
        rank = {item.id: i for i, (item, _) in enumerate(order)}

        for item, target in order:
            hours = round_up_half(item.hours)
            taken = self._place(free, today, target, hours, cap, min_piece) if target >= today else {}
            shortfall = round(hours - sum(taken.values()), 2)
            windows[item.id] = self._window(item, target, taken, shortfall, today)
            self._record(daily, item.id, taken)

        for allocations in daily.values():
            allocations.sort(key=lambda a: rank[a[0]])  # most urgent first within a day
        return Plan(windows, daily)

    @staticmethod
    def _piece(free_day: float, remaining: float, limit: float, min_piece: float) -> float:
        """Hours to take on a day that has none of this task yet, keeping both this piece and the rest ≥ min_piece."""
        take = min(free_day, remaining, limit)
        rest = remaining - take
        if 0 < rest < min_piece:
            if take - (min_piece - rest) >= min_piece:
                take -= min_piece - rest  # leave a full-size piece for another day
            elif free_day >= remaining:
                take = remaining  # small overflow: finish it here, over the cap
            else:
                return 0.0  # would leave a crumb: try another day
        return take if take >= min(min_piece, remaining) else 0.0

    def _place(
        self, free: dict[date, float], today: date, target: date, hours: float, cap: float, min_piece: float
    ) -> dict[date, float]:
        """Takes up to `hours` latest-first from [today, target] in up to three sweeps (see class docstring)."""
        taken: dict[date, float] = {}
        remaining = hours
        for limit, piece in ((cap, min_piece), (math.inf, min_piece), (math.inf, 0.0)):
            day = target
            while remaining > 0 and day >= today:
                free_day = free.get(day, 0.0)
                if day in taken or piece == 0:
                    # growing an existing piece never fragments
                    take = min(free_day, remaining, limit - taken.get(day, 0.0))
                else:
                    take = self._piece(free_day, remaining, limit, piece)
                if take > 0:
                    free[day] -= take
                    taken[day] = taken.get(day, 0.0) + take
                    remaining -= take
                day -= timedelta(days=1)
            if remaining <= 0:
                break
        return taken

    @staticmethod
    def _record(daily: dict[date, list[tuple[int, float]]], item_id: int, taken: dict[date, float]) -> None:
        for day, hours in taken.items():
            daily.setdefault(day, []).append((item_id, hours))

    def _window(
        self, item: PlanItem, target: date, taken: dict[date, float], shortfall: float, today: date
    ) -> WorkWindow:
        start = min(taken) if taken else today
        return WorkWindow(
            start_date=start,
            target_finish=target,
            status=self._status(item.deadline, start, shortfall, today),
            at_risk=shortfall > 0,
            shortfall_hours=shortfall,
        )

    @staticmethod
    def _target_finish(deadline: date, buffer_days: int, today: date) -> date:
        if deadline < today:
            return deadline  # overdue: nothing can be scheduled
        return max(today, deadline - timedelta(days=buffer_days))

    @staticmethod
    def _status(deadline: date, start: date, shortfall: float, today: date) -> Status:
        if shortfall > 0 or deadline < today or (deadline - today).days <= 1:
            return Status.CRITICAL
        if start <= today + timedelta(days=1):
            return Status.TIME_TO_START
        return Status.CAN_WAIT
