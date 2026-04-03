from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app.security import verify_internal_key
from app.tasks.generation_task import get_job
from app.services.file_manager import get_result_path, get_content_type

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.get("/result/{job_id}")
async def result(job_id: str):
    """Tamamlanmış işin sonuç dosyasını stream olarak döndürür."""
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job bulunamadı.")
    if job.get("status") != "completed":
        raise HTTPException(status_code=425, detail="İş henüz tamamlanmadı.")

    path = get_result_path(job_id)
    if not path or not path.exists():
        raise HTTPException(status_code=404, detail="Sonuç dosyası bulunamadı.")

    return FileResponse(
        path=str(path),
        media_type=get_content_type(path),
        filename=path.name,
    )
