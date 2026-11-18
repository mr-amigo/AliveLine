import json

from app.core.deps import get_step_splitter
from app.domain.estimation import OpenAIStepSplitter
from app.domain.estimation.steps import parse_steps
from app.main import app
from app.services.plan_service import local_today
from tests.test_assignments import create, due_in
from tests.test_estimation import FakeOpenAI

STEPS = [{"title": "Research", "hours": 2}, {"title": "Code", "hours": 3}, {"title": "Report", "hours": 1.5}]


def test_put_steps_replaces_list_and_drives_hours(signed_in):
    a = create(signed_in, user_hours=10, deadline=due_in(10))
    r = signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": STEPS})
    assert r.status_code == 200, r.text
    out = r.json()
    assert [s["title"] for s in out["steps"]] == ["Research", "Code", "Report"]
    assert out["effective_hours"] == 6.5  # sum of open steps wins over user_hours

    steps = [{**s, "done": i == 0} for i, s in enumerate(reversed(STEPS))]  # reorder + check off
    out = signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": steps}).json()
    assert [s["title"] for s in out["steps"]] == ["Report", "Code", "Research"]
    assert out["steps"][0]["done"] and out["effective_hours"] == 5

    out = signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": []}).json()
    assert out["steps"] == [] and out["effective_hours"] == 10  # split removed


def test_plan_blocks_carry_step_titles(signed_in):
    a = create(signed_in, deadline=due_in(10))
    signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": STEPS})
    plan = signed_in.get("/api/plan", params={"from": local_today().isoformat(), "days": 14}).json()
    blocks = [i for d in plan["days"] for i in d["items"]]
    titles = [b["step_title"] for b in blocks]
    assert list(dict.fromkeys(titles)) == ["Research", "Code", "Report"]  # in order; Code spans two days
    assert sum(b["hours"] for b in blocks) == 6.5


def test_steps_validation_and_ownership(client, signed_in):
    a = create(signed_in)
    bad = [{"title": "", "hours": 1}, {"title": "x", "hours": 0.3}, {"title": "x", "hours": 1.25}]
    for step in bad:
        assert signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": [step]}).status_code == 422
    assert signed_in.put("/api/assignments/9999/steps", json={"steps": []}).status_code == 404
    signed_in.post("/api/auth/signout")
    assert client.put(f"/api/assignments/{a['id']}/steps", json={"steps": []}).status_code == 401


def test_deleting_assignment_deletes_steps(signed_in):
    a = create(signed_in)
    signed_in.put(f"/api/assignments/{a['id']}/steps", json={"steps": STEPS})
    assert signed_in.delete(f"/api/assignments/{a['id']}").status_code == 204


def test_parse_steps_only_accepts_two_to_four():
    assert parse_steps({"steps": STEPS})[1].hours == 3
    assert parse_steps({"steps": STEPS[:1]}) == []
    assert parse_steps({"steps": STEPS * 2}) == []
    assert parse_steps({"steps": [{"title": " ", "hours": 1}, STEPS[0]]}) == []


def test_splitter_skips_small_tasks_and_falls_back_to_no_steps():
    fake = FakeOpenAI(json.dumps({"steps": STEPS}))
    splitter = OpenAIStepSplitter(fake, "m")
    assert splitter.split("Quiz", "", None, 2) == [] and fake.calls == []
    assert len(splitter.split("Project", "REST API + report", "OOP", 6.5)) == 3
    assert "6.5" in fake.calls[0]["messages"][0]["content"]
    assert OpenAIStepSplitter(FakeOpenAI(error=TimeoutError()), "m").split("Project", "", None, 8) == []
    assert OpenAIStepSplitter(FakeOpenAI("not json"), "m").split("Project", "", None, 8) == []


def test_ai_steps_endpoint(client, signed_in):
    app.dependency_overrides[get_step_splitter] = lambda: OpenAIStepSplitter(FakeOpenAI(json.dumps({"steps": STEPS})), "m")
    def claim() -> dict[str, str]:
        return {"X-AI-Claim": signed_in.post("/api/billing/claim", json={"feature": "steps"}).json()["token"]}

    try:
        r = signed_in.post("/api/ai/steps", json={"title": "Project", "hours": 6.5}, headers=claim())
    finally:
        app.dependency_overrides.pop(get_step_splitter)
    assert r.status_code == 200 and r.json()["steps"][0] == {"title": "Research", "hours": 2.0}
    assert signed_in.post("/api/ai/steps", json={"title": "Project", "hours": 6}, headers=claim()).json() == {"steps": []}  # no LLM
    signed_in.post("/api/auth/signout")
    assert client.post("/api/ai/steps", json={"title": "Project", "hours": 6}).status_code == 401


def test_suggest_steps_setting(signed_in):
    assert signed_in.get("/api/auth/me").json()["suggest_steps"] is True
    assert signed_in.patch("/api/settings", json={"suggest_steps": False}).json()["suggest_steps"] is False
