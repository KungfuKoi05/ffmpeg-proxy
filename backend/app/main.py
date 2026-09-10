"""FastAPI application entry point.

Run with:  uvicorn backend.app.main:app --reload
or simply: python -m backend.run
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api import clips as clips_router
from .api import jobs as jobs_router
from .api import system as system_router
from .config import ROOT_DIR, settings
from .database import init_db
from .utils.errors import UserFacingError
from .utils.logging import configure_logging, get_logger
from .workers.cleanup import cleanup_scheduler
from .workers.job_worker import job_manager

configure_logging(settings.log_level)
log = get_logger(__name__)

FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.ensure_dirs()
    init_db()
    job_manager.requeue_orphans()
    job_manager.start()
    cleanup_scheduler.start()
    log.info("YouTube Clip Generator ready on http://%s:%d", settings.host, settings.port)
    if not FRONTEND_DIST.exists():
        log.info("frontend/dist not built - the API is up; run the Vite dev server for the UI")
    try:
        yield
    finally:
        cleanup_scheduler.stop()
        job_manager.shutdown(wait=False)


app = FastAPI(
    title="YouTube Clip Generator",
    version="1.0.0",
    description="Turn a long video into 5-8 share-ready short clips.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins (never "*") because we send a credentialed cookie.
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Owner-Token"],
    max_age=600,
)


# ---------------------------------------------------------------------------
# Errors: the browser only ever sees {code, message, hint}
# ---------------------------------------------------------------------------
@app.exception_handler(UserFacingError)
async def _user_error_handler(_request: Request, exc: UserFacingError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"detail": exc.to_dict()})


@app.exception_handler(StarletteHTTPException)
async def _http_error_handler(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, dict):
        payload = detail
    else:
        payload = {"code": f"http_{exc.status_code}", "message": str(detail), "hint": ""}
    return JSONResponse(status_code=exc.status_code, content={"detail": payload})


@app.exception_handler(RequestValidationError)
async def _validation_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0] if exc.errors() else {}
    message = str(first.get("msg", "That request wasn't valid."))
    message = message.replace("Value error, ", "")
    return JSONResponse(
        status_code=422,
        content={"detail": {"code": "invalid_request", "message": message, "hint": ""}},
    )


@app.exception_handler(Exception)
async def _unhandled_handler(_request: Request, exc: Exception) -> JSONResponse:
    log.exception("unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": {
                "code": "server_error",
                "message": "Something went wrong on our side.",
                "hint": "Check the server log for details.",
            }
        },
    )


app.include_router(jobs_router.router)
app.include_router(clips_router.router)
app.include_router(system_router.router)


# ---------------------------------------------------------------------------
# Serve the built frontend, when there is one
# ---------------------------------------------------------------------------
if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets", check_dir=False),
        name="assets",
    )

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file() and FRONTEND_DIST in candidate.resolve().parents:
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")

else:

    @app.get("/", include_in_schema=False)
    async def root_placeholder() -> dict:
        return {
            "app": "YouTube Clip Generator",
            "api_docs": "/docs",
            "note": (
                "The web UI isn't built yet. Run `npm install && npm run dev` in frontend/, "
                "or `npm run build` to have this server host it."
            ),
        }
