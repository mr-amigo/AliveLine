from datetime import date, timedelta

from app.domain.planner import PlanItem, PlanSettings, PlanStep, Status, WorkWindowPlanner, round_up_half

TODAY = date(2026, 11, 18)  # Wednesday
planner = WorkWindowPlanner()


def d(days: int) -> date:
    return TODAY + timedelta(days=days)


def plan(items, **kw):
    return planner.plan(items, PlanSettings(**kw), TODAY)


def test_single_item_fits_as_late_as_possible_in_sessions():
    p = plan([PlanItem(1, d(10), 4)])  # 3 h/day, buffer 1, session 2 h
    w = p.windows[1]
    assert w.target_finish == d(9)
    assert p.on(d(9)) == [(1, 2)] and p.on(d(8)) == [(1, 2)]
    assert w.start_date == d(8) and w.status == Status.CAN_WAIT
    assert not w.at_risk and w.shortfall_hours == 0


def test_without_interleave_one_task_fills_the_day():
    p = plan([PlanItem(1, d(10), 4)], interleave=False)
    assert p.on(d(9)) == [(1, 2.5)] and p.on(d(8)) == [(1, 1.5)]  # never a piece under 1.5 h


def test_session_cap_is_exceeded_only_when_the_deadline_needs_it():
    p = plan([PlanItem(1, d(1), 5)], buffer_days=0)  # 2 days × 3 h; 2 h sessions give only 4 h
    assert p.on(d(1)) == [(1, 3)] and p.on(d(0)) == [(1, 2)]
    assert not p.windows[1].at_risk


def test_days_mix_tasks_instead_of_one_long_block():
    items = [PlanItem(1, d(3), 3), PlanItem(2, d(3), 3)]
    mixed = plan(items, buffer_days=0)
    assert mixed.on(d(3)) == [(1, 1.5), (2, 1.5)]
    assert mixed.on(d(2)) == [(1, 1.5), (2, 1.5)]
    blocks = plan(items, buffer_days=0, interleave=False)
    assert blocks.on(d(3)) == [(1, 3)] and blocks.on(d(2)) == [(2, 3)]


def test_earlier_deadline_keeps_its_day_and_comes_first_within_it():
    items = [PlanItem(2, d(5), 6), PlanItem(1, d(4), 3)]
    p = plan(items, buffer_days=0)
    assert p.on(d(4)) == [(1, 1.5), (2, 1.5)]  # most urgent listed first
    assert p.on(d(2)) == [(2, 2.5)]  # 2 h + 0.5 h leftover would be a crumb → one 2.5 h piece
    assert p.windows[1].start_date == d(3) and p.windows[2].start_date == d(2)
    assert not any(w.at_risk for w in p.windows.values())


def test_overload_gives_today_to_the_most_urgent_item():
    urgent = PlanItem(1, d(0), 7)  # due today, can't fit anyway
    far = [PlanItem(10 + i, d(8), 3) for i in range(10)]  # 30 h due in 8 days
    p = plan([urgent, *far])
    assert p.on(TODAY) == [(1, 3)]  # session cap exceeded: nothing else can use today for it
    w = p.windows[1]
    assert w.at_risk and w.shortfall_hours == 4 and w.status == Status.CRITICAL
    # days 1..7 (21 h) finish 7 far items whole; the rest are at risk, not all of them half-done
    assert {i for i in range(10, 20) if p.windows[i].at_risk} == {17, 18, 19}
    assert sum(p.windows[i].shortfall_hours for i in range(10, 20)) == 9


def test_insufficient_capacity_is_at_risk_with_shortfall():
    w = plan([PlanItem(1, d(3), 10)]).windows[1]  # target day 2 → days 0..2 give 9 h
    assert w.at_risk and w.shortfall_hours == 1
    assert w.status == Status.CRITICAL and w.start_date == TODAY


def test_overdue_is_at_risk_and_takes_no_days():
    p = plan([PlanItem(1, d(-2), 2)])
    w = p.windows[1]
    assert w.status == Status.CRITICAL and w.at_risk and w.shortfall_hours == 2 and w.start_date == TODAY
    assert p.daily == {}


def test_no_pieces_below_min_session_unless_forced():
    p = plan([PlanItem(1, d(10), 2.5)])
    assert p.on(d(9)) == [(1, 2.5)]  # cap 2 exceeded a little instead of a 0.5 h crumb
    small = plan([PlanItem(1, d(10), 1)])
    assert small.on(d(9)) == [(1, 1)]  # a task smaller than the minimum is fine
    fine = plan([PlanItem(1, d(10), 4)], min_session_hours=0.5, max_session_hours=1)
    assert [h for day in sorted(fine.daily) for _, h in fine.on(day)] == [1, 1, 1, 1]
    # 0.5 h free on each of 3 days: only crumbs fit, and the deadline needs them
    forced = planner.plan(
        [PlanItem(1, d(2), 1.5)], PlanSettings(buffer_days=0, weekday_hours=(0.5,) * 7), TODAY
    )
    assert not forced.windows[1].at_risk and len(forced.daily) == 3


def test_weekday_hours_skip_days_off():
    weekdays_only = (3, 3, 3, 3, 3, 0, 0)  # Sat + Sun off
    p = plan([PlanItem(1, d(5), 4)], buffer_days=0, weekday_hours=weekdays_only)  # due Monday
    assert d(5).weekday() == 0
    assert p.on(d(4)) == [] and p.on(d(3)) == []
    assert p.on(d(5)) == [(1, 2)] and p.on(d(2)) == [(1, 2)]
    assert PlanSettings(weekday_hours=weekdays_only).hours_on(d(3)) == 0


def test_deadline_tomorrow_is_critical_even_if_it_fits():
    w = plan([PlanItem(1, d(1), 1)], buffer_days=0).windows[1]
    assert w.status == Status.CRITICAL and not w.at_risk


def test_done_item_is_done_and_takes_no_capacity():
    p = plan([PlanItem(1, d(5), 3, done=True), PlanItem(2, d(5), 2)], interleave=False)
    assert p.windows[1].status == Status.DONE
    assert p.windows[2].start_date == d(4)


def test_far_deadline_can_wait():
    assert plan([PlanItem(1, d(30), 3)]).windows[1].status == Status.CAN_WAIT


def test_time_to_start_boundary():
    # start tomorrow → time_to_start; start the day after → can_wait
    tomorrow = plan([PlanItem(1, d(3), 4)], capacity=2)
    assert tomorrow.windows[1].start_date == d(1)
    assert tomorrow.windows[1].status == Status.TIME_TO_START
    later = plan([PlanItem(1, d(4), 4)], capacity=2)
    assert later.windows[1].start_date == d(2)
    assert later.windows[1].status == Status.CAN_WAIT


def test_buffer_never_moves_target_before_today():
    assert plan([PlanItem(1, d(2), 1)], buffer_days=5).windows[1].target_finish == TODAY


def test_hours_round_up_to_half():
    assert round_up_half(1.2) == 1.5 and round_up_half(2.0) == 2.0 and round_up_half(0.1) == 0.5


def test_steps_are_planned_in_order_one_session_per_day():
    steps = (PlanStep(10, 2), PlanStep(11, 2), PlanStep(12, 2))  # research → code → report
    p = plan([PlanItem(1, d(10), 0, steps=steps)])
    assert p.steps_on(d(9), 1) == [(12, 2)]
    assert p.steps_on(d(8), 1) == [(11, 2)]
    assert p.steps_on(d(7), 1) == [(10, 2)]
    assert p.on(d(9)) == [(1, 2)] and p.windows[1].start_date == d(7)


def test_steps_share_the_items_session_cap_and_keep_order_on_a_forced_day():
    two_days = plan([PlanItem(1, d(1), 0, steps=(PlanStep(10, 2), PlanStep(11, 2)))], buffer_days=0)
    assert two_days.steps_on(d(0), 1) == [(10, 2)] and two_days.steps_on(d(1), 1) == [(11, 2)]

    one_day = plan([PlanItem(1, d(0), 0, steps=(PlanStep(10, 1.5), PlanStep(11, 1.5)))], buffer_days=0)
    assert one_day.steps_on(d(0), 1) == [(10, 1.5), (11, 1.5)]  # earlier step listed first
    assert one_day.on(d(0)) == [(1, 3)] and not one_day.windows[1].at_risk


def test_done_steps_are_skipped_and_missing_step_hours_are_shortfall():
    p = plan([PlanItem(1, d(10), 99, steps=(PlanStep(10, 4, done=True), PlanStep(11, 2)))])
    assert sum(h for day in p.daily for _, h in p.on(day)) == 2

    late = plan([PlanItem(1, d(0), 0, steps=(PlanStep(10, 2), PlanStep(11, 3)))], buffer_days=0)
    assert late.windows[1].at_risk and late.windows[1].shortfall_hours == 2
    assert late.steps_on(d(0), 1) == [(11, 3)]  # the last step took today; the first one doesn't fit


def test_a_step_never_leaves_a_crumb_on_a_day_its_next_step_already_uses():
    steps = (PlanStep(10, 1.5), PlanStep(11, 3), PlanStep(12, 1.5))
    p = plan([PlanItem(1, d(5), 0, steps=steps), PlanItem(2, d(4), 3)])
    hours = [h for day in p.daily for (_, h) in p.on(day)] + [h for k in p.step_pieces for _, h in p.step_pieces[k]]
    assert min(hours) >= 1.5
    assert p.steps_on(d(4), 1) == [(12, 1.5)]
