from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.api import auth, health, settings, waitlist
from app.core.db import Base, engine

# Built frontend (frontend/dist) is copied here in the Docker image.
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(engine)  # v1: no migrations (see docs/PLAN.md §3)
    yield


def _mount_frontend(app: FastAPI) -> None:
    """Serve the SPA from the same origin as the API; unknown paths fall back to index.html."""
    index = STATIC_DIR / "index.html"
    if not index.exists():
        return
    if (STATIC_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (STATIC_DIR / path).resolve()
        if path and file.is_file() and STATIC_DIR in file.parents:
            return FileResponse(file)
        return FileResponse(index)


def create_app() -> FastAPI:
    app = FastAPI(
        title="AliveLine API",
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    api = APIRouter(prefix="/api")
    for module in (health, auth, settings, waitlist):
        api.include_router(module.router)
    app.include_router(api)
    _mount_frontend(app)
    return app


app = create_app()
