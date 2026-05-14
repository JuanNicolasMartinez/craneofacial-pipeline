import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.mesh import MeshRead, BiologicalProfileCreate, BiologicalProfileRead
from app.services import mesh_service, case_service

router = APIRouter(prefix="/cases", tags=["meshes"])

ALLOWED_FORMATS = {"ply", "obj", "stl"}


@router.post("/{case_id}/mesh", response_model=MeshRead)
async def upload_mesh(
    case_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    case = await case_service.get_case(db, case_id)
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

    # In production: upload to R2 and store the key.
    # In dev (mock credentials): store a placeholder key.
    r2_key = f"meshes/{case_id}/{file.filename}"

    mesh = await mesh_service.create_mesh_record(
        db, case_id=case_id, r2_key=r2_key, fmt=ext, file_size_bytes=file_size
    )
    return mesh


@router.patch("/{case_id}/biological-profile", response_model=BiologicalProfileRead)
async def update_biological_profile(
    case_id: uuid.UUID,
    data: BiologicalProfileCreate,
    db: AsyncSession = Depends(get_db),
):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return await mesh_service.upsert_biological_profile(db, case_id, data)
