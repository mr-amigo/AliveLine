import os

# Must be set before the app (and its engine) is imported.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["BCRYPT_ROUNDS"] = "4"
os.environ["ENV"] = "test"
# Never call a real LLM from tests, even if the shell has provider keys loaded.
for _key in ("OPENAI_API_KEY", "PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN", "PADDLE_WEBHOOK_SECRET", "BILLING_TESTERS"):
    os.environ.pop(_key, None)

import pytest
from fastapi.testclient import TestClient

from app.core.db import Base, engine
from app.main import app


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def signed_in(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": "ana@ucu.edu.ua", "password": "secret123", "name": "Ana"},
    )
    assert r.status_code == 201
    return client
