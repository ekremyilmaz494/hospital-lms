"""Geçici dosya yönetimi — temizleme ve erişim işlemleri."""
from pathlib import Path
from app.config import TEMP_DIR

RESULT_CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "mp4": "video/mp4",
    "txt": "text/plain; charset=utf-8",
    "json": "application/json",
    "png": "image/png",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "svg": "image/svg+xml",
    "md": "text/markdown; charset=utf-8",
    "html": "text/html; charset=utf-8",
}


def get_result_path(job_id: str) -> Path | None:
    """job_id için geçici sonuç dosyasını bulur."""
    for ext in RESULT_CONTENT_TYPES:
        p = TEMP_DIR / f"{job_id}.{ext}"
        if p.exists():
            return p
    return None


def get_content_type(path: Path) -> str:
    return RESULT_CONTENT_TYPES.get(path.suffix.lstrip("."), "application/octet-stream")


def delete_result(job_id: str) -> bool:
    """Geçici dosyayı siler. Başarılı olursa True döner."""
    path = get_result_path(job_id)
    if path and path.exists():
        path.unlink()
        return True
    return False
