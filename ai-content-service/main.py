import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import health, generate, status, result, analyze, auth, notebooks, sources

app = FastAPI(
    title="AI Content Service",
    description="Hospital LMS — NotebookLM içerik üretim servisi",
    version="1.0.0",
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["X-Internal-Key", "X-Org-Id", "Content-Type"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api", tags=["auth"])
app.include_router(notebooks.router, prefix="/api", tags=["notebooks"])
app.include_router(sources.router, prefix="/api", tags=["sources"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(status.router, prefix="/api", tags=["status"])
app.include_router(result.router, prefix="/api", tags=["download"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=not settings.is_production,
    )
