# ─── Auth Router ───
# Google NotebookLM bağlantı yönetimi.
# TypeScript client contract:
#   POST /api/auth/login     {browser}       → {success, message}
#   POST /api/auth/verify    (empty)         → {valid, error?}
#   POST /api/auth/disconnect (empty)        → {success, message}
# org_id: X-Org-Id header'ından alınır.

import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.security import verify_internal_key
from app.services import auth_service
from app.services.browser_login import start_browser_login, refresh_cookies, get_session_status

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_executor = ThreadPoolExecutor(max_workers=2)


class LoginRequest(BaseModel):
    browser: str = "chromium"


@router.post("/auth/login")
async def login(request: LoginRequest, x_org_id: str = Header(...)):
    """Playwright ile tarayıcı açıp Google login yapar.
    TypeScript client: login(browser) → POST /api/auth/login"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, start_browser_login, x_org_id)

    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Login başarısız."))

    return {"success": True, "message": "Google hesabı başarıyla bağlandı."}


@router.post("/auth/verify")
async def verify(x_org_id: str = Header(...)):
    """Saklanan cookie ile NotebookLM bağlantısını doğrular.
    TypeScript client: verifyAuth() → POST /api/auth/verify"""
    result = await auth_service.verify_connection(x_org_id)

    if result.get("connected"):
        return {"valid": True}
    return {"valid": False, "error": result.get("error", "Doğrulama başarısız")}


@router.post("/auth/refresh")
async def refresh(x_org_id: str = Header(...)):
    """Mevcut browser profili ile cookie'leri sessizce yeniler (headless).
    TypeScript client: refreshAuth() → POST /api/auth/refresh"""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, refresh_cookies, x_org_id)

    if not result.get("success"):
        return {"refreshed": False, "error": result.get("error", "Yenileme başarısız.")}
    return {"refreshed": True}


@router.post("/auth/disconnect")
async def disconnect(x_org_id: str = Header(...)):
    """Cookie'leri siler ve bağlantıyı keser.
    TypeScript client: disconnectAuth() → POST /api/auth/disconnect"""
    auth_service.disconnect(x_org_id)
    return {"success": True, "message": "Bağlantı kesildi."}


@router.get("/auth/browser-status/{org_id}")
async def browser_status(org_id: str):
    """Aktif browser login session durumunu döner."""
    return get_session_status(org_id)
