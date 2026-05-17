import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.case import CaseCreate, CaseRead, CaseList
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(
    data: CaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.create_case(db, data, user.id)
    # Newly created case has no mesh yet, so current_step is "mesh"
    payload = CaseRead.model_validate(case)
    payload.owner_name = user.full_name
    return payload


@router.get("", response_model=list[CaseList])
async def list_cases(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    cases = await case_service.list_cases(db, user.id, limit=limit, offset=offset)
    out: list[CaseList] = []
    for c in cases:
        hydration = await case_service.hydrate_case(db, c.id)
        item = CaseList.model_validate(c)
        item.current_step = hydration.current_step
        item.owner_name = user.full_name
        out.append(item)
    return out


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    hydration = await case_service.hydrate_case(db, case_id)
    payload = CaseRead.model_validate(case)
    payload.owner_name = user.full_name
    payload.current_step = hydration.current_step
    payload.mesh_id = hydration.mesh_id
    payload.mesh_url = hydration.mesh_url
    payload.mesh_format = hydration.mesh_format
    payload.landmark_set_id = hydration.landmark_set_id
    payload.landmark_count = hydration.landmark_count
    payload.has_biological_profile = hydration.has_biological_profile
    payload.last_job_id = hydration.last_job_id
    payload.last_job_status = hydration.last_job_status
    return payload
