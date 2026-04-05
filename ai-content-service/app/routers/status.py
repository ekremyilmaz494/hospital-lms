# ─── Status Router ───
# Üretim durumu sorgulama.
# TypeScript client contract:
#   GET /api/status/{notebook_id}/{task_id}
#     → {task_id, status, progress, artifact_id?, error?}

import logging
from fastapi import APIRouter, Depends, Header, HTTPException

from app.security import verify_internal_key
from app.tasks.generation_task import get_job

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = logging.getLogger(__name__)


@router.get("/status/{notebook_id}/{task_id}")
async def status(notebook_id: str, task_id: str, x_org_id: str = Header(...)):
    """İş durumunu döndürür. TypeScript client: getTaskStatus(notebookId, taskId)"""
    job = get_job(task_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job bulunamadı.")

    return {
        "task_id": task_id,
        "status": job.get("status", "processing"),
        "progress": job.get("progress", 0),
        "artifact_id": job.get("artifact_id"),
        "error": job.get("error"),
    }
