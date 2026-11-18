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


def test_planning_settings(signed_in):
    me = signed_in.get("/api/auth/me").json()
    assert (me["weekday_hours"], me["max_session_hours"], me["min_session_hours"], me["interleave"]) == (None, 2.0, 1.5, True)
    week = [3, 3, 3, 3, 2, 0, 0]
    r = signed_in.patch("/api/settings", json={"weekday_hours": week, "max_session_hours": 1.5, "interleave": False})
    assert r.status_code == 200
    assert (r.json()["weekday_hours"], r.json()["max_session_hours"], r.json()["interleave"]) == (week, 1.5, False)
    days = signed_in.get("/api/plan", params={"from": "2026-11-16", "days": 7}).json()["days"]
    assert [day["capacity"] for day in days] == week
    for bad in ({"weekday_hours": [0] * 7}, {"weekday_hours": [3] * 6}, {"weekday_hours": [13] + [3] * 6},
                {"max_session_hours": 0.3}, {"max_session_hours": 9}, {"min_session_hours": 5}):
        assert signed_in.patch("/api/settings", json=bad).status_code == 422, bad
    # explicit null → same hours every day again; other fields untouched
    r = signed_in.patch("/api/settings", json={"weekday_hours": None})
    assert r.json()["weekday_hours"] is None and r.json()["max_session_hours"] == 1.5


def test_add_missing_columns_adds_new_user_columns():
    from sqlalchemy import create_engine, inspect, text

    from app.core.db import Base, add_missing_columns

    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    with eng.begin() as conn:  # simulate a pre-v2 users table
        for col in ("weekday_hours", "max_session_hours", "interleave"):
            conn.execute(text(f"ALTER TABLE users DROP COLUMN {col}"))
    assert sorted(add_missing_columns(eng)) == ["users.interleave", "users.max_session_hours", "users.weekday_hours"]
    # min_session_hours exists here (create_all); production gets it from the same helper
    assert {"interleave", "max_session_hours"} <= {c["name"] for c in inspect(eng).get_columns("users")}
    assert add_missing_columns(eng) == []
