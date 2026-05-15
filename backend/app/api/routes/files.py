"""
Serves files from the local storage backend. Only mounted when
STORAGE_BACKEND == "local". In R2 mode, presigned URLs go straight to R2.
"""
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.config import settings

router = APIRouter(prefix="/files", tags=["files"])

_BASE = Path(settings.STORAGE_LOCAL_PATH).resolve()


@router.get("/{key:path}")
async def get_file(key: str, download: bool = False):
    target = (_BASE / key).resolve()
    if not target.is_relative_to(_BASE):
        raise HTTPException(status_code=400, detail="Invalid path")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    headers = {}
    if download:
        headers["Content-Disposition"] = f'attachment; filename="{target.name}"'
    return FileResponse(target, headers=headers)
