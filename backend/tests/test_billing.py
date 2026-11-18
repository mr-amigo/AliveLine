import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone

import pytest

from app.core.config import get_settings
from app.domain import billing
from app.domain.billing import Feature, LimitReached, Usage

NOW = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)
SECRET = "pdl_ntfset_test"


# ---- domain rules ----

def test_trials_then_pro_required():
    u = Usage({}, None, 0)
    for _ in range(3):
        billing.consume(u, Feature.STEPS, 1, pro=False, now=NOW)
    assert billing.trials_left(u.trial_uses)["steps"] == 0
    with pytest.raises(LimitReached) as e:
        billing.consume(u, Feature.STEPS, 1, pro=False, now=NOW)
    assert e.value.pro_required
    billing.consume(u, Feature.STEPS, 1, pro=True, now=NOW)  # Pro: unlimited, trials untouched
    assert u.trial_uses["steps"] == 3


def test_core_estimate_free_with_monthly_cap_that_resets():
    u = Usage({}, "2026-11", 99)
    billing.consume(u, Feature.ESTIMATE, 1, pro=False, now=NOW)
    with pytest.raises(LimitReached) as e:
        billing.consume(u, Feature.ESTIMATE, 1, pro=False, now=NOW)
    assert e.value.pro_required  # Pro raises the cap
    billing.consume(u, Feature.ESTIMATE, 1, pro=False, now=NOW + timedelta(days=14))  # December
    assert (u.ai_month, u.ai_month_count) == ("2026-12", 1)


def test_is_pro_keeps_grace_after_period_end():
    assert billing.is_pro("pro", None, NOW)
    assert billing.is_pro("pro", NOW - timedelta(days=2), NOW)
    assert not billing.is_pro("pro", NOW - timedelta(days=4), NOW)
    assert not billing.is_pro("free", None, NOW)
    assert billing.subscription_plan("past_due", NOW) == ("pro", NOW)
    assert billing.subscription_plan("canceled", NOW) == ("free", None)


# ---- API ----

def test_billing_summary_and_claims(signed_in):
    b = signed_in.get("/api/billing").json()
    assert b["plan"] == "free" and b["trials_left"] == {"reestimate": 3, "steps": 3}
    assert b["checkout"] is None  # no Paddle config in tests

    for left in (2, 1, 0):
        r = signed_in.post("/api/billing/claim", json={"feature": "steps"})
        assert r.status_code == 200 and r.json()["billing"]["trials_left"]["steps"] == left
    assert r.json()["billing"]["ai_used"] == 3
    r = signed_in.post("/api/billing/claim", json={"feature": "steps"})
    assert r.status_code == 402 and "Pro" in r.json()["detail"]
    assert signed_in.post("/api/billing/claim", json={"feature": "estimate"}).status_code == 200  # core stays free


def test_second_ai_estimate_of_an_assignment_is_a_reestimate(signed_in):
    est = {"hours": 3, "rationale": "r", "source": "ai"}
    a = signed_in.post("/api/assignments", json={"title": "Lab", "deadline": "2026-12-01T10:00:00Z", "estimate": est}).json()
    r = signed_in.post("/api/billing/claim", json={"feature": "estimate", "assignment_id": a["id"]})
    assert r.json()["feature"] == "reestimate" and r.json()["billing"]["trials_left"]["reestimate"] == 2
    new = signed_in.post("/api/billing/claim", json={"feature": "estimate"}).json()
    assert new["feature"] == "estimate" and new["billing"]["trials_left"]["reestimate"] == 2


def test_claim_is_bound_to_user_and_scope(client):
    for email in ("a@ucu.edu.ua", "b@ucu.edu.ua"):
        client.post("/api/auth/signup", json={"email": email, "password": "secret123", "name": "X"})
    token = client.post("/api/billing/claim", json={"feature": "steps"}).json()["token"]  # b's claim
    h = {"X-AI-Claim": token}
    assert client.post("/api/ai/estimate", json={"title": "Lab"}, headers=h).status_code == 401  # wrong scope
    client.post("/api/auth/signin", json={"email": "a@ucu.edu.ua", "password": "secret123"})
    assert client.post("/api/ai/steps", json={"title": "P", "hours": 6}, headers=h).status_code == 401  # other user


# ---- webhooks ----

@pytest.fixture
def paddle_secret(monkeypatch):
    monkeypatch.setenv("PADDLE_WEBHOOK_SECRET", SECRET)
    get_settings.cache_clear()
    yield
    monkeypatch.delenv("PADDLE_WEBHOOK_SECRET")
    get_settings.cache_clear()


def _send(client, event: dict, secret: str = SECRET):
    raw = json.dumps(event).encode()
    ts = str(int(time.time()))
    h1 = hmac.new(secret.encode(), f"{ts}:".encode() + raw, hashlib.sha256).hexdigest()
    return client.post("/api/billing/webhook", content=raw, headers={"Paddle-Signature": f"ts={ts};h1={h1}"})


def _sub_event(event_id: str, status: str, occurred: str, user_id: int | None = 1) -> dict:
    data = {"id": "sub_1", "customer_id": "ctm_1", "status": status,
            "current_billing_period": {"ends_at": "2099-01-01T00:00:00Z"}}
    if user_id is not None:
        data["custom_data"] = {"user_id": str(user_id)}
    return {"event_id": event_id, "event_type": f"subscription.{status}", "occurred_at": occurred, "data": data}


def test_webhook_activates_and_cancels_pro(signed_in, paddle_secret):
    assert _send(signed_in, _sub_event("evt_1", "active", "2026-11-18T10:00:00Z")).json() == {"result": "pro (active)"}
    b = signed_in.get("/api/billing").json()
    assert b["plan"] == "pro" and b["can_manage"] and b["ai_limit"] == 1000
    assert _send(signed_in, _sub_event("evt_1", "active", "2026-11-18T10:00:00Z")).json() == {"result": "duplicate"}
    # later events find the user by subscription id even without custom_data
    assert _send(signed_in, _sub_event("evt_2", "canceled", "2026-11-19T10:00:00Z", None)).json() == {"result": "free (canceled)"}
    assert _send(signed_in, _sub_event("evt_3", "active", "2026-11-18T11:00:00Z")).json() == {"result": "out of order"}
    assert signed_in.get("/api/billing").json()["plan"] == "free"


def test_webhook_rejects_bad_signature(signed_in, paddle_secret):
    r = _send(signed_in, _sub_event("evt_x", "active", "2026-11-18T10:00:00Z"), secret="wrong")
    assert r.status_code == 400
    assert signed_in.post("/api/billing/webhook", content=b"{}").status_code == 400
    assert signed_in.get("/api/billing").json()["plan"] == "free"


def test_checkout_only_for_testers_in_sandbox(signed_in, monkeypatch):
    for k, v in {"PADDLE_CLIENT_TOKEN": "test_x", "PADDLE_PRICE_MONTHLY": "pri_m", "PADDLE_PRICE_YEARLY": "pri_y"}.items():
        monkeypatch.setenv(k, v)
    get_settings.cache_clear()
    try:
        assert signed_in.get("/api/billing").json()["checkout"] is None
        monkeypatch.setenv("BILLING_TESTERS", "x@y.z, ana@ucu.edu.ua")
        get_settings.cache_clear()
        assert signed_in.get("/api/billing").json()["checkout"]["prices"] == {"monthly": "pri_m", "yearly": "pri_y"}
    finally:
        get_settings.cache_clear()


def test_portal_claim_needs_a_customer(signed_in):
    assert signed_in.post("/api/billing/portal-claim").status_code == 404
