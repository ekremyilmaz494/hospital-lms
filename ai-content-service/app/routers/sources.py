# ─── Sources Router ───
# NotebookLM kaynak yönetimi (dosya/URL/YouTube/metin ekleme, durum sorgulama).
# TypeScript client contract:
#   POST /api/sources/add              (multipart) → {source_id, status}
#   GET  /api/sources/status/{nid}/{sid}            → {source_id, status, title?}
#   POST /api/sources/wait/{nid}/{sid}              → {source_id, status, title?}

import logging
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, Form
from typing import Optional

from app.security import verify_internal_key
from app.services.client_factory import get_client
from app.config import TEMP_DIR

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = logging.getLogger(__name__)


@router.post("/sources/add")
async def add_source(
    x_org_id: str = Header(...),
    notebook_id: str = Form(...),
    source_type: str = Form(...),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
):
    """Notebook'a kaynak ekler (dosya, URL, YouTube veya metin)."""
    try:
        async with await get_client(x_org_id) as client:
            if source_type == "file" and file:
                # Dosyayı geçici klasöre yaz, notebooklm-py'ye gönder
                temp_path = TEMP_DIR / f"upload_{file.filename}"
                try:
                    file_bytes = await file.read()
                    temp_path.write_bytes(file_bytes)
                    source = await client.sources.add_file(
                        notebook_id, str(temp_path), wait=False
                    )
                finally:
                    temp_path.unlink(missing_ok=True)
            elif source_type == "url" and url:
                source = await client.sources.add_url(
                    notebook_id, url, wait=False
                )
            elif source_type == "youtube" and url:
                source = await client.sources.add_youtube(
                    notebook_id, url, wait=False
                )
            elif source_type == "text" and content:
                source = await client.sources.add_text(
                    notebook_id,
                    title=title or "Metin Kaynağı",
                    content=content,
                    wait=False,
                )
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Geçersiz source_type veya eksik veri: {source_type}",
                )

            return {
                "source_id": source.id if hasattr(source, "id") else str(source),
                "status": "processing",
            }
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Kaynak ekleme hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")


@router.get("/sources/status/{notebook_id}/{source_id}")
async def source_status(
    notebook_id: str,
    source_id: str,
    x_org_id: str = Header(...),
):
    """Kaynak işlenme durumunu sorgular."""
    try:
        async with await get_client(x_org_id) as client:
            sources = await client.sources.list(notebook_id)
            for s in (sources or []):
                if s.id == source_id:
                    return {
                        "source_id": s.id,
                        "status": getattr(s, "status", "ready"),
                        "title": getattr(s, "title", None),
                    }
            return {"source_id": source_id, "status": "ready"}
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Kaynak durum sorgusu hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")


@router.post("/sources/wait/{notebook_id}/{source_id}")
async def wait_for_source(
    notebook_id: str,
    source_id: str,
    x_org_id: str = Header(...),
):
    """Kaynak hazır olana kadar bekler (blocking, max 120s)."""
    try:
        async with await get_client(x_org_id) as client:
            max_wait = 120
            for _ in range(max_wait // 3):
                sources = await client.sources.list(notebook_id)
                for s in (sources or []):
                    if s.id == source_id:
                        status = getattr(s, "status", "ready")
                        if status in ("ready", "error"):
                            return {
                                "source_id": s.id,
                                "status": status,
                                "title": getattr(s, "title", None),
                            }
                await asyncio.sleep(3)
            return {"source_id": source_id, "status": "ready"}
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Kaynak bekleme hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")
