# ─── Browser Login Servisi ───
# Playwright ile Google NotebookLM'e otomatik tarayıcı login.
# Admin "Bağlan" tıklayınca sunucuda tarayıcı açılır,
# kullanıcı giriş yapar, cookie otomatik yakalanıp kaydedilir.
# Her org için izole browser profili kullanılır.

import asyncio
import json
import base64
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.auth_store.cookie_manager import save_cookie
from app.config import TEMP_DIR

NOTEBOOKLM_URL = "https://notebooklm.google.com/"
NOTEBOOKLM_HOST = "notebooklm.google.com"
GOOGLE_ACCOUNTS_URL = "https://accounts.google.com/"

# Org bazlı browser profilleri
PROFILES_DIR = Path(__file__).resolve().parent.parent.parent / "browser_profiles"
PROFILES_DIR.mkdir(exist_ok=True)

# Aktif login session'ları takibi
_active_sessions: dict[str, dict] = {}


def _get_profile_dir(org_id: str) -> Path:
    """Organizasyon bazlı Playwright browser profili."""
    p = PROFILES_DIR / org_id
    p.mkdir(exist_ok=True)
    return p


def start_browser_login(org_id: str) -> dict:
    """Tarayıcı login session'ı başlatır (senkron, thread'de çalışır).
    Playwright persistent context açar, NotebookLM'e yönlendirir.
    Kullanıcı giriş yapana kadar bekler, sonra cookie'leri yakalar.
    """
    _active_sessions[org_id] = {"status": "waiting", "started_at": datetime.now(timezone.utc).isoformat()}

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"success": False, "error": "Playwright yüklü değil. pip install playwright && playwright install chromium"}

    profile_dir = _get_profile_dir(org_id)
    storage_path = TEMP_DIR / f"{org_id}_storage.json"

    try:
        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=False,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--password-store=basic",
                ],
                ignore_default_args=["--enable-automation"],
            )

            page = context.pages[0] if context.pages else context.new_page()
            page.goto(NOTEBOOKLM_URL, wait_until="load")

            _active_sessions[org_id] = {"status": "browser_open", "started_at": _active_sessions[org_id]["started_at"]}

            # NotebookLM ana sayfasına ulaşana kadar bekle (max 120 saniye)
            max_wait = 120
            for _ in range(max_wait):
                current_url = page.url
                if NOTEBOOKLM_HOST in current_url and "signin" not in current_url and "accounts.google" not in current_url:
                    # Giriş yapılmış — biraz bekle ve cookie'leri kaydet
                    page.wait_for_timeout(2000)

                    # Regional cookie'ler için Google accounts'a da git
                    page.goto(GOOGLE_ACCOUNTS_URL, wait_until="load")
                    page.goto(NOTEBOOKLM_URL, wait_until="load")
                    page.wait_for_timeout(1000)

                    # Storage state kaydet
                    context.storage_state(path=str(storage_path))
                    context.close()

                    # Storage state'den cookie'leri çıkar ve şifreli kaydet
                    return _process_storage_state(org_id, storage_path)

                page.wait_for_timeout(1000)

            # Zaman aşımı
            context.close()
            return {"success": False, "error": "Giriş zaman aşımı (120 saniye). Lütfen tekrar deneyin."}

    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        _active_sessions.pop(org_id, None)
        # Geçici storage dosyasını temizle
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)


def _process_storage_state(org_id: str, storage_path: Path) -> dict:
    """Playwright storage state JSON'dan cookie'leri çıkarır,
    notebooklm-py auth formatına dönüştürür ve şifreli kaydeder."""
    try:
        from notebooklm.auth import extract_cookies_from_storage, fetch_tokens

        with open(storage_path) as f:
            storage_data = json.load(f)

        # Storage'dan cookie'leri çıkar
        cookies = extract_cookies_from_storage(storage_data)
        if not cookies:
            return {"success": False, "error": "Cookie çıkarılamadı — giriş tamamlanmamış olabilir."}

        # Token'ları al — thread'den çağrıldığı için yeni loop kullanabiliriz
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, fetch_tokens(cookies))
            csrf_token, session_id = future.result(timeout=30)

        # Auth verisini oluştur — orijinal storage state de sakla (download için)
        auth_data = {
            "cookies": cookies,
            "csrf_token": csrf_token,
            "session_id": session_id,
            "storage_state": storage_data,
        }

        # E-posta adresini cookie'den çıkar (varsa)
        email = ""
        for cookie in storage_data.get("cookies", []):
            if cookie.get("name") == "SAPISID" or cookie.get("name") == "__Secure-1PAPISID":
                email = cookie.get("value", "")[:5] + "..."  # Gizli
                break

        # Şifreli kaydet
        save_cookie(org_id, auth_data)

        return {
            "success": True,
            "email": email,
            "method": "browser",
            "cookies_count": len(cookies),
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        return {"success": False, "error": f"Cookie işleme hatası: {e}"}


def refresh_cookies(org_id: str) -> dict:
    """Mevcut browser profili ile headless cookie yenileme.
    Profildeki session cookie'ler tarayıcı açıldığında Google tarafından
    otomatik yenilenir. Kullanıcı müdahalesi gerekmez."""
    profile_dir = _get_profile_dir(org_id)
    if not profile_dir.exists() or not any(profile_dir.iterdir()):
        return {"success": False, "error": "Browser profili bulunamadı. Lütfen önce Google hesabı bağlayın."}

    storage_path = TEMP_DIR / f"{org_id}_refresh.json"
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            context = p.chromium.launch_persistent_context(
                user_data_dir=str(profile_dir),
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--password-store=basic",
                ],
                ignore_default_args=["--enable-automation"],
            )

            page = context.pages[0] if context.pages else context.new_page()
            page.goto(NOTEBOOKLM_URL, wait_until="load", timeout=30000)
            page.wait_for_timeout(3000)

            current_url = page.url
            if "signin" in current_url or "accounts.google" in current_url:
                context.close()
                return {"success": False, "error": "Oturum süresi dolmuş, tekrar giriş gerekli."}

            # Cookie'ler hâlâ geçerli — yenile ve kaydet
            page.goto(GOOGLE_ACCOUNTS_URL, wait_until="load")
            page.goto(NOTEBOOKLM_URL, wait_until="load")
            page.wait_for_timeout(1000)

            context.storage_state(path=str(storage_path))
            context.close()

            return _process_storage_state(org_id, storage_path)

    except Exception as e:
        return {"success": False, "error": f"Cookie yenileme hatası: {e}"}
    finally:
        if storage_path.exists():
            storage_path.unlink(missing_ok=True)


def get_session_status(org_id: str) -> dict:
    """Aktif login session durumunu döner."""
    return _active_sessions.get(org_id, {"status": "none"})
