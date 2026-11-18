from datetime import date, timedelta

from app.domain.planner import PlanItem, Status, WorkWindowPlanner, round_up_half

TODAY = date(2026, 11, 18)
planner = WorkWindowPlanner()


def d(days: int) -> date:
    return TODAY + timedelta(days=days)


def test_single_item_fits_as_late_as_possible():
    plan = planner.plan([PlanItem(1, d(10), 4)], capacity=3, buffer_days=1, today=TODAY)
    w = plan.windows[1]
    assert w.target_finish == d(9)
    assert w.start_date == d(8)  # 3h on day 9, 1h on day 8
    assert plan.on(d(9)) == [(1, 3)] and plan.on(d(8)) == [(1, 1)]
    assert w.status == Status.CAN_WAIT and w.unscheduled_hours == 0


def test_overlapping_items_push_the_earlier_one_earlier():
    items = [PlanItem(1, d(6), 3), PlanItem(2, d(6), 3)]  # same target day, capacity 3/day
    plan = planner.plan(items, capacity=3, buffer_days=1, today=TODAY)
    starts = sorted(w.start_date for w in plan.windows.values())
    assert starts == [d(4), d(5)]


def test_earlier_deadline_keeps_its_day_and_later_item_works_around_it():
    items = [PlanItem(1, d(4), 3), PlanItem(2, d(5), 6)]
    plan = planner.plan(items, capacity=3, buffer_days=0, today=TODAY)
    assert plan.windows[1].start_date == d(4)  # its own target day
    assert plan.windows[2].start_date == d(3)  # days 5 and 3
    assert all(w.unscheduled_hours == 0 for w in plan.windows.values())


def test_overload_gives_today_to_the_most_urgent_item():
    urgent = PlanItem(1, d(0), 7)  # due today, can't fit anyway
    far = [PlanItem(10 + i, d(8), 3) for i in range(10)]  # 30 h due in 8 days
    plan = planner.plan([urgent, *far], capacity=3, buffer_days=1, today=TODAY)
    assert plan.on(TODAY) == [(1, 3)]
    assert plan.windows[1].unscheduled_hours == 4 and plan.windows[1].status == Status.CRITICAL
    overflow = sum(plan.windows[i].unscheduled_hours for i in range(10, 20))
    assert overflow == 30 - 3 * 7  # days 1..7 left for the far items


def test_insufficient_capacity_is_critical_with_unscheduled_hours():
    plan = planner.plan([PlanItem(1, d(3), 10)], capacity=3, buffer_days=1, today=TODAY)
    w = plan.windows[1]
    assert w.status == Status.CRITICAL
    assert w.unscheduled_hours == 1  # target = day 2 (buffer 1) → days 0..2 give 9h of the 10h
    assert w.start_date == TODAY


def test_overdue_is_critical_and_unscheduled():
    plan = planner.plan([PlanItem(1, d(-2), 2)], capacity=3, buffer_days=1, today=TODAY)
    w = plan.windows[1]
    assert w.status == Status.CRITICAL and w.unscheduled_hours == 2 and w.start_date == TODAY
    assert plan.daily == {}


def test_deadline_tomorrow_is_critical_even_if_it_fits():
    plan = planner.plan([PlanItem(1, d(1), 1)], capacity=3, buffer_days=0, today=TODAY)
    assert plan.windows[1].status == Status.CRITICAL


def test_done_item_is_done_and_takes_no_capacity():
    items = [PlanItem(1, d(5), 3, done=True), PlanItem(2, d(5), 3)]
    plan = planner.plan(items, capacity=3, buffer_days=1, today=TODAY)
    assert plan.windows[1].status == Status.DONE
    assert plan.windows[2].start_date == d(4)


def test_far_deadline_can_wait():
    plan = planner.plan([PlanItem(1, d(30), 3)], capacity=3, buffer_days=1, today=TODAY)
    assert plan.windows[1].status == Status.CAN_WAIT


def test_time_to_start_boundary():
    # start tomorrow → time_to_start; start the day after → can_wait
    tomorrow = planner.plan([PlanItem(1, d(3), 4)], capacity=2, buffer_days=1, today=TODAY)
    assert tomorrow.windows[1].start_date == d(1)
    assert tomorrow.windows[1].status == Status.TIME_TO_START
    later = planner.plan([PlanItem(1, d(4), 4)], capacity=2, buffer_days=1, today=TODAY)
    assert later.windows[1].start_date == d(2)
    assert later.windows[1].status == Status.CAN_WAIT


def test_buffer_never_moves_target_before_today():
    plan = planner.plan([PlanItem(1, d(2), 1)], capacity=3, buffer_days=5, today=TODAY)
    assert plan.windows[1].target_finish == TODAY


def test_hours_round_up_to_half():
    assert round_up_half(1.2) == 1.5 and round_up_half(2.0) == 2.0 and round_up_half(0.1) == 0.5
