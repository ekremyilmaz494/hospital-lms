import asyncio
from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import GenerateRequest, GenerateResponse
from app.security import verify_internal_key
from app.tasks.generation_task import run_generation, jobs

router = APIRouter(dependencies=[Depends(verify_internal_key)])


@router.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest):
    """Üretim işini başlatır (background task) ve hemen job_id döndürür."""
    if request.job_id in jobs:
        raise HTTPException(status_code=409, detail="Bu job_id zaten mevcut.")

    # Background'da çalıştır — endpoint hemen döner
    asyncio.create_task(run_generation(request.job_id, request))

    return GenerateResponse(job_id=request.job_id, status="queued")
