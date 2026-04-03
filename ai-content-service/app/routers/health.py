from fastapi import APIRouter
from app.config import settings

router = APIRouter()


@router.get("/health")
async def health():
    auth_configured = bool(settings.notebooklm_auth_json)
    return {
        "status": "ok",
        "notebooklm_auth": "configured" if auth_configured else "missing",
    }
