from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.logging import configure_logging
from app.core.redis import close_arq_pool
from app.engine.clients import close_ai_clients


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    yield
    await close_arq_pool()
    await close_ai_clients()
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
)

from app.core.rate_limit import RateLimitMiddleware  # noqa: E402

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RateLimitMiddleware)

app.include_router(api_router)


@app.get("/")
def root():
    return {"message": "Welcome to the TijaratkBot API", "docs": "/docs"}
