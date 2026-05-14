import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.landmark import LandmarkSetCreate, LandmarkSetRead
from app.services import landmark_service, case_service

router = APIRouter(prefix="/cases", tags=["landmarks"])


@router.patch("/{case_id}/landmarks", response_model=LandmarkSetRead)
async def save_landmarks(
    case_id: uuid.UUID,
    data: LandmarkSetCreate,
    db: AsyncSession = Depends(get_db),
):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    if len(data.landmarks) != 21:
        raise HTTPException(
            status_code=422,
            detail=f"Expected 21 landmarks, got {len(data.landmarks)}",
        )

    lm_set = await landmark_service.save_landmark_set(db, case_id, data)
    await case_service.update_case_status(db, case_id, "landmarks_ready")
    return lm_set
