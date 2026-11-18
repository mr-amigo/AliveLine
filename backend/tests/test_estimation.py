import json
import logging
from types import SimpleNamespace as NS

import pytest

from app.core import deps
from app.core.deps import get_estimator
from app.domain.estimation import HeuristicEstimator, OpenAIEstimator
from app.domain.estimation.llm import parse_estimate, user_prompt
from app.main import app


class FakeOpenAI:
    def __init__(self, content=None, error=None):
        self.calls, self.content, self.error = [], content, error
        self.chat = NS(completions=NS(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return NS(
            choices=[NS(message=NS(content=self.content), finish_reason="stop")],
            usage=NS(prompt_tokens=120, completion_tokens=30),
        )


def test_openai_estimator_parses_strict_json(caplog):
    client = FakeOpenAI(json.dumps({"hours": 6.3, "rationale": "Two tasks and a report."}))
    with caplog.at_level(logging.INFO, logger="aliveline.estimate"):
        est = OpenAIEstimator(client, "gpt-test").estimate("Lab 3", "Implement and test", "OOAD")
    assert (est.hours, est.rationale, est.source) == (6.5, "Two tasks and a report.", "ai")
    call = client.calls[0]
    assert call["model"] == "gpt-test" and call["response_format"]["json_schema"]["strict"] is True
    assert "<course>OOAD</course>" in call["messages"][1]["content"]
    assert '"input_tokens": 120' in caplog.text


@pytest.mark.parametrize(
    "client",
    [
        FakeOpenAI(error=TimeoutError("slow")),
        FakeOpenAI("not json"),
        FakeOpenAI(json.dumps({"rationale": "no hours"})),
        FakeOpenAI(json.dumps({"hours": -2, "rationale": "x"})),
        FakeOpenAI(None),
    ],
)
def test_openai_failures_fall_back_to_heuristic(client):
    est = OpenAIEstimator(client, "m").estimate("Quiz 2")
    assert est.source == "heuristic" and est.hours == 1.0


def test_openai_estimate_is_clamped():
    est = OpenAIEstimator(FakeOpenAI(json.dumps({"hours": 90, "rationale": "Huge"})), "m").estimate("Thesis")
    assert est.hours == 40 and est.source == "ai"


def test_prompt_caps_input_and_parse_defaults():
    assert len(user_prompt("t" * 500, "d" * 9000, None)) < 4400
    assert parse_estimate({"hours": "2", "rationale": ""}).rationale == "Estimated by AI."


def test_factory_picks_provider(monkeypatch):
    def configured(**env):
        deps.get_settings.cache_clear(), deps._openai_client.cache_clear()
        for k in ("OPENAI_API_KEY",):
            monkeypatch.delenv(k, raising=False)
        for k, v in env.items():
            monkeypatch.setenv(k, v)
        return deps._configured_estimator()

    try:
        assert isinstance(configured(), HeuristicEstimator)
        assert isinstance(configured(OPENAI_API_KEY="k"), OpenAIEstimator)
    finally:
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        deps.get_settings.cache_clear(), deps._openai_client.cache_clear()


def test_ai_estimate_endpoint(client, signed_in):
    app.dependency_overrides[get_estimator] = lambda: OpenAIEstimator(FakeOpenAI(json.dumps({"hours": 4, "rationale": "ok"})), "m")
    try:
        token = signed_in.post("/api/billing/claim", json={"feature": "estimate"}).json()["token"]
        h = {"X-AI-Claim": token}
        r = signed_in.post("/api/ai/estimate", json={"title": "Lab 3", "description": "REST API"}, headers=h)
    finally:
        app.dependency_overrides.pop(get_estimator)
    assert r.status_code == 200 and r.json() == {"hours": 4.0, "rationale": "ok", "source": "ai"}
    assert signed_in.post("/api/ai/estimate", json={"title": ""}, headers=h).status_code == 422
    assert signed_in.post("/api/ai/estimate", json={"title": "Lab"}).status_code == 401  # no claim


def test_ai_estimate_requires_auth(client):
    assert client.post("/api/ai/estimate", json={"title": "Lab"}).status_code == 401


def test_ai_handler_app_mounts_only_ai():
    from fastapi.testclient import TestClient

    from app.ai_handler import app as ai_app

    c = TestClient(ai_app)
    assert c.post("/api/ai/estimate", json={"title": "x"}).status_code == 401
    assert c.get("/api/health").status_code == 404
