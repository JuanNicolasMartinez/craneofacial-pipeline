import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.storage import get_storage
from app.models.user import User
from app.schemas.mesh import MeshRead, BiologicalProfileCreate, BiologicalProfileRead
from app.services import mesh_service, case_service

router = APIRouter(prefix="/cases", tags=["meshes"])

ALLOWED_FORMATS = {"ply", "obj", "stl"}
_CONTENT_TYPES = {"ply": "model/ply", "obj": "model/obj", "stl": "model/stl"}


@router.post("/{case_id}/mesh", response_model=MeshRead)
async def upload_mesh(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format. Allowed: {ALLOWED_FORMATS}",
        )

    content = await file.read()
    file_size = len(content)

    storage = get_storage()
    storage_key = f"meshes/{case_id}/{file.filename}"
    await storage.upload(storage_key, content, content_type=_CONTENT_TYPES[ext])

    mesh = await mesh_service.create_mesh_record(
        db, case_id=case_id, r2_key=storage_key, fmt=ext, file_size_bytes=file_size
    )
    return mesh


@router.patch("/{case_id}/biological-profile", response_model=BiologicalProfileRead)
async def update_biological_profile(
    case_id: uuid.UUID,
    data: BiologicalProfileCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return await mesh_service.upsert_biological_profile(db, case_id, data)
