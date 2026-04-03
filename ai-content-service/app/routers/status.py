from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import StatusResponse
from app.security import verify_internal_key
from app.tasks.generation_task import get_job
from app.services.file_manager import get_result_path, get_content_type

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.get("/status/{job_id}", response_model=StatusResponse)
async def status(job_id: str):
    """İş durumunu döndürür."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job bulunamadı.")

    result_type = None
    if job.get("status") == "completed":
        path = get_result_path(job_id)
        if path:
            ct = get_content_type(path)
            if "audio" in ct:
                result_type = "audio"
            elif "video" in ct:
                result_type = "video"
            elif "json" in ct:
                result_type = "json"
            elif "image" in ct:
                result_type = "image"
            elif "presentation" in ct or "pptx" in ct:
                result_type = "presentation"
            elif "markdown" in ct:
                result_type = "document"
            else:
                result_type = "text"

    return StatusResponse(
        job_id=job_id,
        status=job.get("status", "unknown"),
        progress=job.get("progress", 0),
        result_type=result_type,
        result_path=job.get("result_path"),
        error=job.get("error"),
    )
