import asyncio
import logging
from typing import Dict, Any

from app.models.schemas import GenerateRequest
from app.services.notebooklm_service import generate_content

logger = logging.getLogger(__name__)

# In-memory job store: job_id → state dict
# TTL yönetimi Next.js tarafındaki Redis ile yapılır;
# bu dict yalnızca Python servisinin çalışma süresince tutulur.
jobs: Dict[str, Dict[str, Any]] = {}


async def _update_status(job_id: str, status: str, progress: int, result_path: str | None = None) -> None:
    jobs[job_id] = {
        "status": status,
        "progress": progress,
        "result_path": result_path,
        "error": None,
    }


async def run_generation(job_id: str, request: GenerateRequest) -> None:
    """Background task — NotebookLM üretimini çalıştırır ve durumu günceller."""
    jobs[job_id] = {"status": "queued", "progress": 0, "result_path": None, "error": None}

    try:
        await generate_content(job_id, request, _update_status)
    except Exception as exc:
        logger.exception("Generation failed for job %s: %s", job_id, exc)
        jobs[job_id] = {
            "status": "failed",
            "progress": 0,
            "result_path": None,
            "error": str(exc),
        }


def get_job(job_id: str) -> Dict[str, Any] | None:
    return jobs.get(job_id)
