from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import (
    approvals,
    auth,
    dependencies_router,
    metrics,
    notifications,
    progress,
    subtasks,
    tasks,
    users,
)
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Dev convenience: create tables + seed. In production use Alembic migrations.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.SEED_ON_STARTUP:
        async with SessionLocal() as db:
            await seed(db)
    yield
    await engine.dispose()


app = FastAPI(title="TaskFlow API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    if isinstance(detail, dict) and "code" in detail:
        body = {"error": {"code": detail["code"], "message": detail.get("message", ""), "details": detail.get("details", {})}}
    else:
        body = {"error": {"code": "HTTP_ERROR", "message": str(detail), "details": {}}}
    return JSONResponse(status_code=exc.status_code, content=body)


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid request.", "details": {"errors": jsonable_encoder(exc.errors())}}},
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


API = "/api/v1"
app.include_router(auth.router, prefix=API)
app.include_router(users.router, prefix=API)
app.include_router(tasks.router, prefix=API)
app.include_router(subtasks.router, prefix=API)
app.include_router(dependencies_router.router, prefix=API)
app.include_router(progress.router, prefix=API)
app.include_router(approvals.router, prefix=API)
app.include_router(notifications.router, prefix=API)
app.include_router(metrics.router, prefix=API)
