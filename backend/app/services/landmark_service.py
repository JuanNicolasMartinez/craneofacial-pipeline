import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.landmark import LandmarkSet, Landmark
from app.schemas.landmark import LandmarkSetCreate


async def save_landmark_set(
    db: AsyncSession,
    case_id: uuid.UUID,
    data: LandmarkSetCreate,
) -> LandmarkSet:
    lm_set = LandmarkSet(
        case_id=case_id,
        operator=data.operator,
    )
    db.add(lm_set)
    await db.flush()

    for lm_in in data.landmarks:
        lm = Landmark(set_id=lm_set.id, **lm_in.model_dump())
        db.add(lm)

    await db.commit()
    await db.refresh(lm_set)
    return lm_set


async def get_latest_landmark_set(
    db: AsyncSession, case_id: uuid.UUID
) -> LandmarkSet | None:
    result = await db.execute(
        select(LandmarkSet)
        .where(LandmarkSet.case_id == case_id)
        .order_by(LandmarkSet.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
