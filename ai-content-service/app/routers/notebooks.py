# ─── Notebooks Router ───
# NotebookLM notebook CRUD.
# TypeScript client contract:
#   POST /api/notebooks/create {title} → {id, title}
#   GET  /api/notebooks/list           → {notebooks: [{id, title}]}

import logging
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from app.security import verify_internal_key
from app.services.client_factory import get_client

router = APIRouter(dependencies=[Depends(verify_internal_key)])
logger = logging.getLogger(__name__)


class CreateNotebookRequest(BaseModel):
    title: str


@router.post("/notebooks/create")
async def create_notebook(request: CreateNotebookRequest, x_org_id: str = Header(...)):
    """NotebookLM'de yeni notebook oluşturur."""
    try:
        async with await get_client(x_org_id) as client:
            notebook = await client.notebooks.create(title=request.title)
            return {"id": notebook.id, "title": request.title}
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Notebook oluşturma hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")


@router.get("/notebooks/list")
async def list_notebooks(x_org_id: str = Header(...)):
    """Tüm notebook'ları listeler."""
    try:
        async with await get_client(x_org_id) as client:
            notebooks = await client.notebooks.list()
            return {
                "notebooks": [
                    {"id": n.id, "title": getattr(n, "title", "")}
                    for n in (notebooks or [])
                ]
            }
    except RuntimeError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.exception("Notebook listeleme hatası: %s", e)
        raise HTTPException(status_code=502, detail=f"NotebookLM hatası: {e}")
