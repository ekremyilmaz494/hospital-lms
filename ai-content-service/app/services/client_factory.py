# ─── NotebookLM Client Factory ───
# Org bazlı NotebookLMClient oluşturur.
# Cookie store'dan org'un auth bilgisini okur ve client döner.

import json
import os
import logging

from app.auth_store.cookie_manager import load_cookie
from app.config import settings

logger = logging.getLogger(__name__)


def _set_download_cookies(cookie_data: dict) -> None:
    """Download için NOTEBOOKLM_AUTH_JSON env var'ına cookie yazar.
    Öncelik: orijinal Playwright storage state (tam domain bilgisiyle),
    yoksa cookie dict'inden oluşturulmuş storage state."""
    # Orijinal storage state varsa onu kullan (domain bilgileri korunur)
    storage_state = cookie_data.get("storage_state")
    if storage_state and isinstance(storage_state, dict):
        os.environ["NOTEBOOKLM_AUTH_JSON"] = json.dumps(storage_state)
        logger.info("Download cookie'leri ayarlandı (orijinal storage state)")
        return

    # Fallback: cookie dict'inden oluştur
    raw_cookies = cookie_data.get("cookies", {})
    if isinstance(raw_cookies, dict):
        pw_cookies = []
        # notebooklm-py download fonksiyonu bu domain'lere cookie bekliyor
        # contribution.usercontent.google.com Google'ın içerik indirme CDN'i
        DOWNLOAD_DOMAINS = [
            ".google.com",
            ".googleusercontent.com",
            "notebooklm.google.com",
            "contribution.usercontent.google.com",
        ]
        for name, value in raw_cookies.items():
            for domain in DOWNLOAD_DOMAINS:
                pw_cookies.append({
                    "name": name, "value": value, "domain": domain,
                    "path": "/", "secure": True, "httpOnly": True,
                })
        os.environ["NOTEBOOKLM_AUTH_JSON"] = json.dumps({"cookies": pw_cookies, "origins": []})
        logger.info("Download cookie'leri ayarlandı (fallback, %d cookie × %d domain)", len(raw_cookies), len(DOWNLOAD_DOMAINS))


async def get_client(org_id: str):
    """Org bazlı NotebookLMClient oluşturur. async with ile kullanılmalı."""
    from notebooklm import NotebookLMClient, AuthTokens

    cookie_data = load_cookie(org_id)
    if not cookie_data:
        raise RuntimeError("Google hesabı bağlı değil. Ayarlar sayfasından bağlantı kurun.")

    auth_fields = {"cookies", "csrf_token", "session_id"}
    src = cookie_data.get("auth_state", cookie_data)
    tokens = AuthTokens(**{k: v for k, v in src.items() if k in auth_fields})
    _set_download_cookies(src if "auth_state" in cookie_data else cookie_data)

    return NotebookLMClient(tokens)
