from datetime import datetime, timedelta, timezone

from app.core.db import SessionLocal
from app.lambda_handler import handler
from app.models import LoginEvent, User


def test_stats_action_counts_waitlist_users_and_returning(signed_in):
    client = signed_in
    client.post("/api/waitlist", json={"email": "w1@ucu.edu.ua"})
    client.post("/api/waitlist", json={"email": "w2@ucu.edu.ua"})
    client.post("/api/auth/signout")
    client.post("/api/auth/signup", json={"email": "bo@ucu.edu.ua", "password": "secret123", "name": "Bo"})
    # Ana signs in again the same day → still one distinct day.
    client.post("/api/auth/signin", json={"email": "ana@ucu.edu.ua", "password": "secret123"})

    assert handler({"action": "stats"}, None) == {
        "waitlist": 2, "users": 2, "returning_users": 0, "assignments": 0,
    }

    with SessionLocal() as db:
        ana = db.query(User).filter_by(email="ana@ucu.edu.ua").one()
        db.add(LoginEvent(user_id=ana.id, at=datetime.now(timezone.utc) - timedelta(days=2)))
        db.commit()

    assert handler({"action": "stats"}, None)["returning_users"] == 1


def test_delete_user_action(signed_in):
    assert handler({"action": "delete_user", "email": "ANA@ucu.edu.ua"}, None) == {"deleted": True}
    assert handler({"action": "delete_user", "email": "ana@ucu.edu.ua"}, None) == {"deleted": False}
    assert handler({"action": "stats"}, None)["users"] == 0
