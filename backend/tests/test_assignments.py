from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from app.core.deps import get_estimator
from app.domain.estimation import Estimate, HeuristicEstimator
from app.main import app
from app.services.plan_service import local_today

KYIV = ZoneInfo("Europe/Kyiv")


def due_in(days: int) -> str:
    """Deadline at 23:59 Kyiv time, `days` calendar days from today, as ISO UTC."""
    day = local_today() + timedelta(days=days)
    return datetime.combine(day, time(23, 59), KYIV).astimezone(timezone.utc).isoformat()


def create(client, **overrides):
    body = {"title": "Lab 3", "deadline": due_in(10), **overrides}
    r = client.post("/api/assignments", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def test_requires_auth(client):
    assert client.post("/api/assignments", json={"title": "x", "deadline": due_in(1)}).status_code == 401
    assert client.get("/api/plan").status_code == 401


def test_create_uses_server_heuristic_without_client_estimate(signed_in):
    a = create(signed_in, title="Lab report 3", course_name="OOAD")
    assert a["estimate_source"] == "heuristic"
    assert a["ai_hours"] == 4.0 and a["effective_hours"] == 4.0
    assert a["course_name"] == "OOAD" and a["source"] == "manual" and a["done"] is False
    assert a["deadline"].endswith("Z")
    assert a["window"]["status"] == "can_wait"


def test_create_with_client_estimate_and_user_hours(signed_in):
    a = create(signed_in, estimate={"hours": 7, "rationale": "Two parts", "source": "ai"}, user_hours=5)
    assert (a["ai_hours"], a["ai_rationale"], a["estimate_source"]) == (7, "Two parts", "ai")
    assert a["effective_hours"] == 5


def test_estimator_dependency_is_overridable(signed_in):
    class Fake:
        def estimate(self, title, description="", course=None):
            return Estimate(hours=12, rationale="fake", source="ai")

    app.dependency_overrides[get_estimator] = Fake
    try:
        assert create(signed_in)["ai_hours"] == 12
    finally:
        app.dependency_overrides.pop(get_estimator)


def test_update_fields_clear_correction_and_mark_done(signed_in):
    a = create(signed_in, user_hours=6, course_name="Calculus")
    r = signed_in.patch(f"/api/assignments/{a['id']}", json={"user_hours": None, "course_name": "", "done": True})
    assert r.status_code == 200
    body = r.json()
    assert body["user_hours"] is None and body["course_name"] is None and body["done"] is True
    assert body["window"]["status"] == "done"


def test_heuristic_estimate_follows_text_changes(signed_in):
    a = create(signed_in, title="Quiz 1")
    assert a["ai_hours"] == 1.0
    body = signed_in.patch(f"/api/assignments/{a['id']}", json={"title": "Final project"}).json()
    assert body["ai_hours"] == 10.0


def test_delete(signed_in):
    a = create(signed_in)
    assert signed_in.delete(f"/api/assignments/{a['id']}").status_code == 204
    assert signed_in.delete(f"/api/assignments/{a['id']}").status_code == 404


def test_other_users_assignment_is_404(client, signed_in):
    a = create(signed_in)
    client.post("/api/auth/signout")
    client.post("/api/auth/signup", json={"email": "bob@ucu.edu.ua", "password": "secret123", "name": "Bob"})
    assert client.patch(f"/api/assignments/{a['id']}", json={"done": True}).status_code == 404
    assert client.delete(f"/api/assignments/{a['id']}").status_code == 404
    assert client.get("/api/plan").json()["assignments"] == []


@pytest.mark.parametrize("payload", [{"title": ""}, {"title": "x"}, {"title": "x", "deadline": "nope"}])
def test_validation(signed_in, payload):
    assert signed_in.post("/api/assignments", json=payload).status_code == 422


def test_plan_statuses_today_and_range(signed_in):
    signed_in.patch("/api/settings", json={"daily_capacity_hours": 3, "buffer_days": 1})
    critical = create(signed_in, title="Essay", deadline=due_in(1), user_hours=2)
    start_now = create(signed_in, title="Project", deadline=due_in(4), user_hours=9)  # needs today..day 3
    later = create(signed_in, title="Quiz", deadline=due_in(20), user_hours=1)
    overdue = create(signed_in, title="Old lab", deadline=due_in(-3), user_hours=2)

    plan = signed_in.get("/api/plan", params={"from": local_today().isoformat(), "days": 14}).json()
    status = {a["id"]: a["window"]["status"] for a in plan["assignments"]}
    assert status[critical["id"]] == "critical"
    assert status[start_now["id"]] == "time_to_start"
    assert status[later["id"]] == "can_wait"
    assert status[overdue["id"]] == "critical"
    assert plan["capacity"] == 3 and plan["today"] == local_today().isoformat()

    assert len(plan["days"]) == 14 and plan["days"][0]["date"] == plan["today"]
    assert sum(i["hours"] for i in plan["today_items"]) <= 3
    assert plan["today_items"] == plan["days"][0]["items"]
    scheduled = sum(i["hours"] for d in plan["days"] for i in d["items"] if i["assignment_id"] == start_now["id"])
    assert scheduled == 9


def test_plan_defaults_to_current_week(signed_in):
    plan = signed_in.get("/api/plan").json()
    first = datetime.fromisoformat(plan["days"][0]["date"]).date()
    assert first.weekday() == 0 and len(plan["days"]) == 7
    assert signed_in.get("/api/plan", params={"days": 99}).status_code == 422


def test_heuristic_rules():
    h = HeuristicEstimator()
    assert h.estimate("Midterm exam prep").hours == 6
    assert h.estimate("Read chapter").hours == 3
    long = h.estimate("Essay", " ".join(["word"] * 300))
    assert long.hours == 7 and "300-word" in long.rationale
    assert h.estimate("Project", " ".join(["w"] * 5000)).hours == 14  # extra capped at 4 h
    assert h.estimate("Lab 3", "Implement the API and write tests").hours == 4  # title wins over description
    assert h.estimate("Week 5", "Prepare for the midterm exam").hours == 6  # description used when title is generic
