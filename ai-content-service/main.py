from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import health, generate, status, result, analyze, auth

app = FastAPI(
    title="AI Content Service",
    description="Hospital LMS — NotebookLM içerik üretim servisi",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

# Yalnızca Next.js'ten gelen isteklere izin ver
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["X-Internal-Key", "Content-Type"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(generate.router, prefix="/api", tags=["generate"])
app.include_router(status.router, prefix="/api", tags=["status"])
app.include_router(result.router, prefix="/api", tags=["result"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(auth.router, prefix="/api", tags=["auth"])


if __name__ == "__main__":
    import uvicorn
    from app.config import settings

    uvicorn.run("main:app", host="0.0.0.0", port=settings.port, reload=True)
