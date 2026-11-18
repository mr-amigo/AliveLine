from sqlalchemy import func, select

from app.core.db import SessionLocal
from app.models import LoginEvent, WaitlistEntry

SIGNUP = {"email": "Ana@UCU.edu.ua", "password": "secret123", "name": "Ana"}


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_signup_sets_session_and_me_works(client):
    r = client.post("/api/auth/signup", json=SIGNUP)
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "ana@ucu.edu.ua"
    assert body["daily_capacity_hours"] == 3.0
    assert "password_hash" not in body
    assert "al_session" in r.cookies
    me = client.get("/api/auth/me").json()
    assert me["id"] == body["id"]
    assert me["created_at"].endswith("Z")


def test_signup_duplicate_email_case_insensitive(client):
    client.post("/api/auth/signup", json=SIGNUP)
    r = client.post("/api/auth/signup", json={**SIGNUP, "email": "ana@ucu.edu.ua"})
    assert r.status_code == 409


def test_signup_validation(client):
    assert client.post("/api/auth/signup", json={**SIGNUP, "password": "short"}).status_code == 422
    assert client.post("/api/auth/signup", json={**SIGNUP, "email": "nope"}).status_code == 422


def test_me_requires_auth(client):
    assert client.get("/api/auth/me").status_code == 401
    client.cookies.set("al_session", "garbage")
    assert client.get("/api/auth/me").status_code == 401


def test_signin_and_signout(client):
    client.post("/api/auth/signup", json=SIGNUP)
    client.post("/api/auth/signout")
    assert client.get("/api/auth/me").status_code == 401

    bad = client.post("/api/auth/signin", json={"email": SIGNUP["email"], "password": "wrongpass"})
    assert bad.status_code == 401
    unknown = client.post("/api/auth/signin", json={"email": "x@y.com", "password": "secret123"})
    assert unknown.status_code == 401
    assert bad.json()["detail"] == unknown.json()["detail"]

    ok = client.post("/api/auth/signin", json={"email": "ana@ucu.edu.ua", "password": "secret123"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").status_code == 200

    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(LoginEvent)) == 2


def test_update_settings(signed_in):
    r = signed_in.patch("/api/settings", json={"daily_capacity_hours": 4.5, "buffer_days": 2})
    assert r.status_code == 200
    assert (r.json()["daily_capacity_hours"], r.json()["buffer_days"]) == (4.5, 2)
    assert signed_in.patch("/api/settings", json={"daily_capacity_hours": 20}).status_code == 422


def test_waitlist_is_idempotent(client):
    assert client.post("/api/waitlist", json={"email": "a@b.com"}).status_code == 201
    assert client.post("/api/waitlist", json={"email": "A@b.com"}).status_code == 201
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(WaitlistEntry)) == 1
