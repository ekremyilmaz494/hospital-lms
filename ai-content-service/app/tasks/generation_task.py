"""Üretim görevi yöneticisi — in-memory job store + background task runner."""

import asyncio
import logging
import uuid
from typing import Dict, Any, Optional

from app.services.notebooklm_service import generate_content, generate_from_notebook
from app.services.client_factory import get_client
from app.models.schemas import GenerateRequest

logger = logging.getLogger(__name__)

# In-memory job store: job_id → state dict
jobs: Dict[str, Dict[str, Any]] = {}


async def _update_status(
    job_id: str, status: str, progress: int,
    result_path: str | None = None, artifact_id: str | None = None
) -> None:
    jobs[job_id] = {
        "status": status,
        "progress": progress,
        "result_path": result_path,
        "artifact_id": artifact_id,
        "error": None,
    }


# ─── V2: Notebook-first generation (TypeScript client contract) ───

async def run_generation_v2(
    org_id: str,
    notebook_id: str,
    artifact_type: str,
    instructions: Optional[str] = None,
    settings: Optional[dict] = None,
) -> dict:
    """Mevcut notebook'tan artifact üretir. Background task başlatır."""
    task_id = str(uuid.uuid4())

    jobs[task_id] = {
        "status": "processing", "progress": 5,
        "error": None, "artifact_id": None, "result_path": None,
    }

    # Background task — kendi client'ını oluşturacak
    asyncio.create_task(_run_notebook_generation(
        task_id, org_id, notebook_id, artifact_type, instructions, settings or {}
    ))

    return {
        "task_id": task_id,
        "artifact_id": None,
        "artifact_type": artifact_type,
        "status": "processing",
    }


async def _run_notebook_generation(
    task_id: str,
    org_id: str,
    notebook_id: str,
    artifact_type: str,
    instructions: Optional[str],
    settings: dict,
) -> None:
    """Background: Kendi client'ını oluşturur ve notebook bazlı üretim çalıştırır."""
    try:
        async with await get_client(org_id) as client:
            await generate_from_notebook(
                task_id=task_id,
                client=client,
                notebook_id=notebook_id,
                artifact_type=artifact_type,
                instructions=instructions,
                settings=settings,
                update_status=_update_status,
            )
    except Exception as exc:
        logger.exception("Generation failed for task %s: %s", task_id, exc)
        jobs[task_id] = {
            "status": "failed",
            "progress": 0,
            "result_path": None,
            "artifact_id": None,
            "error": str(exc),
        }


# ─── V1: Legacy — document_text based generation ───

async def run_generation(job_id: str, request: GenerateRequest) -> None:
    """Eski stil üretim — uyumluluk için korundu."""
    jobs[job_id] = {"status": "queued", "progress": 0, "result_path": None, "artifact_id": None, "error": None}
    try:
        await generate_content(job_id, request, _update_status)
    except Exception as exc:
        logger.exception("Generation failed for job %s: %s", job_id, exc)
        jobs[job_id] = {"status": "failed", "progress": 0, "result_path": None, "artifact_id": None, "error": str(exc)}


def get_job(job_id: str) -> Dict[str, Any] | None:
    return jobs.get(job_id)
