import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.case import CaseCreate, CaseRead, CaseList
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(data: CaseCreate, db: AsyncSession = Depends(get_db)):
    case = await case_service.create_case(db, data)
    # Newly created case has no mesh yet, so current_step is "mesh"
    return CaseRead.model_validate(case)


@router.get("", response_model=list[CaseList])
async def list_cases(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    cases = await case_service.list_cases(db, limit=limit, offset=offset)
    out: list[CaseList] = []
    for c in cases:
        hydration = await case_service.hydrate_case(db, c.id)
        item = CaseList.model_validate(c)
        item.current_step = hydration.current_step
        out.append(item)
    return out


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    hydration = await case_service.hydrate_case(db, case_id)
    payload = CaseRead.model_validate(case)
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
