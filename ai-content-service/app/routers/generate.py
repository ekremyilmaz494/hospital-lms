# ─── Generate Router ───
# AI içerik üretimi başlatır.
# TypeScript client contract:
#   POST /api/generate {notebook_id, artifact_type, instructions?, settings?}
#     → {task_id, artifact_id, artifact_type, status}

import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.security import verify_internal_key
from app.tasks.generation_task import run_generation_v2

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    notebook_id: str
    artifact_type: str
    instructions: Optional[str] = None
    settings: Optional[dict] = None


@router.post("/generate")
async def generate(request: GenerateRequest, x_org_id: str = Header(...)):
    """Notebook bazlı içerik üretimi başlatır.
    Client oluşturma background task'a bırakılır (async with lifecycle)."""
    try:
        result = await run_generation_v2(
            org_id=x_org_id,
            notebook_id=request.notebook_id,
            artifact_type=request.artifact_type,
            instructions=request.instructions,
            settings=request.settings or {},
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Üretim başlatma hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")
