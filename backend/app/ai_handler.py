"""AWS Lambda entry point of the AI estimator (outside the VPC, so it can reach the LLM provider).

Same container image as the backend, started with this handler. Only the /api/ai router is mounted:
no database is touched; auth is the session cookie's JWT, verified with the shared SECRET_KEY.
"""

import logging
from typing import Any

from fastapi import APIRouter, FastAPI
from mangum import Mangum

from app.api import ai

logging.getLogger("aliveline").setLevel(logging.INFO)

app = FastAPI(title="AliveLine AI", docs_url=None, redoc_url=None, openapi_url=None)
_api = APIRouter(prefix="/api")
_api.include_router(ai.router)
app.include_router(_api)

_http = Mangum(app, lifespan="off")


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    return _http(event, context)
