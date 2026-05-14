import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.case import CaseCreate, CaseRead, CaseList
from app.services import case_service

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseRead, status_code=status.HTTP_201_CREATED)
async def create_case(data: CaseCreate, db: AsyncSession = Depends(get_db)):
    return await case_service.create_case(db, data)


@router.get("", response_model=list[CaseList])
async def list_cases(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    return await case_service.list_cases(db, limit=limit, offset=offset)


@router.get("/{case_id}", response_model=CaseRead)
async def get_case(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
