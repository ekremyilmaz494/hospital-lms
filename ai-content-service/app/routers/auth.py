# ─── Auth Router ───
# Google NotebookLM bağlantı yönetimi endpoint'leri.
# Tüm endpoint'ler INTERNAL_API_KEY doğrulaması gerektirir.
# Browser login: Playwright ile tarayıcı açılır, kullanıcı giriş yapar, cookie otomatik kaydedilir.

import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.security import verify_internal_key
from app.services import auth_service
from app.services.browser_login import start_browser_login, get_session_status

router = APIRouter(dependencies=[Depends(verify_internal_key)])
_executor = ThreadPoolExecutor(max_workers=2)


# ─── Request/Response Modelleri ───

class ConnectRequest(BaseModel):
    org_id: str
    email: str
    method: str = "browser"  # "browser" veya "cookie"
    cookie_data: Optional[dict] = None


class BrowserLoginRequest(BaseModel):
    org_id: str
    email: str


class VerifyRequest(BaseModel):
    org_id: str


class TestRequest(BaseModel):
    org_id: str


class DisconnectRequest(BaseModel):
    org_id: str


# ─── Endpoint'ler ───

@router.post("/auth/connect")
async def connect(request: ConnectRequest):
    """Google NotebookLM bağlantısı kurar.
    Browser: Playwright tarayıcı açar, giriş yapılınca cookie otomatik kaydedilir.
    Cookie: verilen cookie'yi doğrular ve kaydeder.
    """
    if request.method == "browser":
        # Playwright senkron çalışır — thread pool'da çalıştır
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, start_browser_login, request.org_id)
    elif request.method == "cookie":
        if not request.cookie_data:
            raise HTTPException(status_code=400, detail="Cookie method için cookie_data zorunludur.")
        result = await auth_service.connect_with_cookie(
            request.org_id, request.email, request.cookie_data
        )
    else:
        raise HTTPException(status_code=400, detail="method 'browser' veya 'cookie' olmalıdır.")

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Bağlantı başarısız."))

    return result


@router.post("/auth/browser-login")
async def browser_login(request: BrowserLoginRequest):
    """Tarayıcı açarak Google giriş yapar — cookie otomatik kaydedilir.
    Admin bu endpoint'i çağırınca sunucuda Chromium tarayıcı açılır.
    Kullanıcı Google hesabıyla giriş yapar.
    NotebookLM ana sayfası göründüğünde cookie otomatik yakalanır.
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, start_browser_login, request.org_id)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Login başarısız."))

    return result


@router.get("/auth/browser-status/{org_id}")
async def browser_status(org_id: str):
    """Aktif browser login session durumunu döner."""
    return get_session_status(org_id)


@router.post("/auth/verify")
async def verify(request: VerifyRequest):
    """Saklanan cookie ile NotebookLM'e test bağlantısı yapar."""
    result = await auth_service.verify_connection(request.org_id)
    return result


@router.get("/auth/status/{org_id}")
async def status(org_id: str):
    """Bağlantı durumunu döner (connected, email, method, last_used)."""
    return auth_service.get_connection_status(org_id)


@router.post("/auth/test")
async def test(request: TestRequest):
    """Gerçek NotebookLM isteği yaparak bağlantıyı test eder."""
    result = await auth_service.test_connection(request.org_id)
    if not result.get("success"):
        raise HTTPException(status_code=502, detail=result.get("error", "Test başarısız."))
    return result


@router.post("/auth/disconnect")
async def disconnect(request: DisconnectRequest):
    """Cookie dosyasını siler ve bağlantıyı keser."""
    result = auth_service.disconnect(request.org_id)
    return result
