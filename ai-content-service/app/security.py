from fastapi import Header, HTTPException
from app.config import settings


async def verify_internal_key(x_internal_key: str = Header(...)):
    """INTERNAL_API_KEY doğrulama — yalnızca Next.js servisi bu API'yi çağırabilir."""
    if x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")
