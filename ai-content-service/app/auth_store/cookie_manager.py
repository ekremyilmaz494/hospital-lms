# ─── Cookie Manager ───
# Fernet (AES) ile şifreli cookie dosya yönetimi.
# Her organizasyonun NotebookLM cookie'si auth_store/{org_id}.enc olarak saklanır.
# Şifreleme anahtarı INTERNAL_API_KEY'den türetilir (PBKDF2 + Fernet).

import base64
import hashlib
import json
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet

from app.config import settings

# Şifreli cookie dosyalarının saklandığı klasör
STORE_DIR = Path(__file__).resolve().parent.parent.parent / "auth_store"
STORE_DIR.mkdir(exist_ok=True)


def _get_fernet() -> Fernet:
    """INTERNAL_API_KEY'den deterministik Fernet anahtarı türetir."""
    key_bytes = settings.internal_api_key.encode("utf-8")
    # SHA-256 → 32 byte → base64 urlsafe (Fernet formatı)
    digest = hashlib.sha256(key_bytes).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def save_cookie(org_id: str, cookie_data: dict) -> Path:
    """Cookie verisini şifreleyerek dosyaya yazar."""
    fernet = _get_fernet()
    plaintext = json.dumps(cookie_data).encode("utf-8")
    encrypted = fernet.encrypt(plaintext)

    file_path = STORE_DIR / f"{org_id}.enc"
    file_path.write_bytes(encrypted)
    return file_path


def load_cookie(org_id: str) -> Optional[dict]:
    """Şifreli cookie dosyasını okur ve çözer. Yoksa None döner."""
    file_path = STORE_DIR / f"{org_id}.enc"
    if not file_path.exists():
        return None

    fernet = _get_fernet()
    encrypted = file_path.read_bytes()
    try:
        plaintext = fernet.decrypt(encrypted)
        return json.loads(plaintext.decode("utf-8"))
    except Exception:
        return None


def delete_cookie(org_id: str) -> bool:
    """Şifreli cookie dosyasını siler. Başarılıysa True döner."""
    file_path = STORE_DIR / f"{org_id}.enc"
    if file_path.exists():
        file_path.unlink()
        return True
    return False


def cookie_exists(org_id: str) -> bool:
    """Cookie dosyası var mı kontrol eder."""
    return (STORE_DIR / f"{org_id}.enc").exists()
