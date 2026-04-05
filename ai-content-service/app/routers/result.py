# ─── Download Router ───
# Tamamlanmış artifact dosyasını indirir.
# TypeScript client contract:
#   GET /api/download/{notebook_id}/{artifact_id}?artifact_type=X&output_format=Y
#     → Binary file (Buffer)

import logging
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import FileResponse

from app.security import verify_internal_key
from app.tasks.generation_task import get_job, jobs
from app.services.file_manager import get_result_path, get_content_type

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = logging.getLogger(__name__)


def _find_job_by_artifact_id(artifact_id: str) -> dict | None:
    """Job store'daki tüm job'larda artifact_id eşleşmesi arar.
    V2 akışında task_id ≠ artifact_id olduğunda dosyayı bulmak için gerekli."""
    for job in jobs.values():
        if job.get("artifact_id") == artifact_id:
            return job
    return None


@router.get("/download/{notebook_id}/{artifact_id}")
async def download(
    notebook_id: str,
    artifact_id: str,
    artifact_type: str = Query(...),
    output_format: str = Query(None),
    x_org_id: str = Header(...),
):
    """Artifact dosyasını stream olarak döndürür.
    TypeScript client: downloadArtifact(notebookId, artifactId, artifactType, outputFormat?)

    Dosya araması: artifact_id veya job store'daki result_path ile bulunur.
    V2 akışında artifact_id (NotebookLM ID) ile task_id (sidecar ID) farklı
    olabilir — her ikisiyle de arama yapılır."""
    # 1. artifact_id ile dosya ara
    path = get_result_path(artifact_id)
    if path and path.exists():
        return FileResponse(
            path=str(path),
            media_type=get_content_type(path),
            filename=path.name,
        )

    # 2. Job store'da artifact_id ile ara (V2: artifact_id olarak kaydedilmiş olabilir)
    job = get_job(artifact_id)

    # 3. Job bulunamazsa, tüm job'larda artifact_id eşleşmesi ara
    if job is None:
        job = _find_job_by_artifact_id(artifact_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Artifact bulunamadı.")
    if job.get("status") != "completed":
        raise HTTPException(status_code=425, detail="Üretim henüz tamamlanmadı.")

    # result_path varsa dosyadan dön
    result_path_str = job.get("result_path")
    if result_path_str:
        from pathlib import Path as P
        rp = P(result_path_str)
        if rp.exists():
            return FileResponse(
                path=str(rp),
                media_type=get_content_type(rp),
                filename=rp.name,
            )

    raise HTTPException(status_code=404, detail="Artifact dosyası bulunamadı.")
