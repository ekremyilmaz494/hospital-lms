# ─── Auth Service ───
# NotebookLM-py login yönetimi, cookie okuma/yazma ve bağlantı doğrulama.
# Her organizasyonun kendi NotebookLM oturumu vardır (multi-tenant izolasyon).

import base64
import json
import time
from datetime import datetime, timezone
from typing import Optional

from app.auth_store.cookie_manager import (
    save_cookie,
    load_cookie,
    delete_cookie,
    cookie_exists,
)


async def connect_with_cookie(org_id: str, email: str, cookie_data: dict) -> dict:
    """Verilen cookie verisini doğrular ve kaydeder."""
    # Cookie verisini kaydet
    save_cookie(org_id, cookie_data)

    # Doğrulama yap
    verified = await verify_connection(org_id)
    if not verified["connected"]:
        delete_cookie(org_id)
        return {
            "success": False,
            "error": verified.get("error", "Cookie doğrulaması başarısız."),
        }

    return {
        "success": True,
        "email": email,
        "method": "cookie",
        "connected_at": datetime.now(timezone.utc).isoformat(),
    }


async def connect_with_browser(org_id: str, email: str) -> dict:
    """Browser login desteklenmiyor — NotebookLMClient auth parametresi zorunlu.
    Kullanıcıyı cookie yöntemine yönlendirir."""
    return {
        "success": False,
        "error": "Browser login şu an desteklenmiyor. Lütfen Manuel Cookie yöntemini kullanın.",
    }


async def verify_connection(org_id: str) -> dict:
    """Saklanan cookie ile NotebookLM'e test bağlantısı yapar."""
    cookie_data = load_cookie(org_id)
    if not cookie_data:
        return {"connected": False, "error": "Cookie bulunamadı."}

    try:
        from notebooklm import NotebookLMClient, AuthTokens  # noqa: PLC0415

        # Cookie'den auth token oluştur — sadece AuthTokens'ın kabul ettiği alanları gönder
        auth_fields = {"cookies", "csrf_token", "session_id"}
        src = cookie_data.get("auth_state", cookie_data)
        tokens = AuthTokens(**{k: v for k, v in src.items() if k in auth_fields})

        async with NotebookLMClient(tokens) as client:
            # Basit bir istek yaparak bağlantıyı doğrula
            notebooks = await client.notebooks.list()
            return {
                "connected": True,
                "email": cookie_data.get("email", ""),
                "last_verified": datetime.now(timezone.utc).isoformat(),
                "notebook_count": len(notebooks) if notebooks else 0,
            }
    except Exception as e:
        return {"connected": False, "error": str(e)}


async def test_connection(org_id: str) -> dict:
    """Gerçek NotebookLM isteği yaparak bağlantıyı ve yanıt süresini test eder."""
    cookie_data = load_cookie(org_id)
    if not cookie_data:
        return {"success": False, "error": "Cookie bulunamadı.", "response_time_ms": 0}

    start_time = time.monotonic()
    try:
        from notebooklm import NotebookLMClient, AuthTokens  # noqa: PLC0415

        auth_fields = {"cookies", "csrf_token", "session_id"}
        src = cookie_data.get("auth_state", cookie_data)
        tokens = AuthTokens(**{k: v for k, v in src.items() if k in auth_fields})

        async with NotebookLMClient(tokens) as client:
            # Notebook oluştur ve hemen sil — gerçek API testi
            notebook = await client.notebooks.create(title="LMS-connection-test")
            await client.notebooks.delete(notebook.id)

            elapsed = int((time.monotonic() - start_time) * 1000)
            return {
                "success": True,
                "response_time_ms": elapsed,
                "message": "Bağlantı başarılı — notebook oluşturma/silme testi geçti.",
            }
    except Exception as e:
        elapsed = int((time.monotonic() - start_time) * 1000)
        return {"success": False, "error": str(e), "response_time_ms": elapsed}


def get_connection_status(org_id: str) -> dict:
    """Bağlantı durumunu döner (cookie dosyasından)."""
    if not cookie_exists(org_id):
        return {"connected": False, "email": None, "method": None}

    cookie_data = load_cookie(org_id)
    if not cookie_data:
        return {"connected": False, "email": None, "method": None, "error": "Cookie okunamadı."}

    return {
        "connected": True,
        "email": cookie_data.get("email", ""),
        "method": cookie_data.get("method", "cookie"),
        "created_at": cookie_data.get("created_at"),
    }


def disconnect(org_id: str) -> dict:
    """Cookie dosyasını siler ve bağlantıyı keser."""
    deleted = delete_cookie(org_id)
    return {"disconnected": deleted}
