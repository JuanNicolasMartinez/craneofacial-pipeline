import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.case import Case
from app.schemas.case import CaseCreate


async def create_case(db: AsyncSession, data: CaseCreate) -> Case:
    case = Case(**data.model_dump())
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


async def get_case(db: AsyncSession, case_id: uuid.UUID) -> Case | None:
    result = await db.execute(select(Case).where(Case.id == case_id))
    return result.scalar_one_or_none()


async def list_cases(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[Case]:
    result = await db.execute(
        select(Case).order_by(Case.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def update_case_status(
    db: AsyncSession, case_id: uuid.UUID, status: str
) -> Case | None:
    case = await get_case(db, case_id)
    if not case:
        return None
    case.status = status
    await db.commit()
    await db.refresh(case)
    return case
