from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    """Health check — TypeScript expects: {status, service, version, notebooklm}"""
    return {
        "status": "ok",
        "service": "ai-content-service",
        "version": "1.0.0",
        "notebooklm": "configured" if settings.notebooklm_auth_json else "cookie-based",
    }
