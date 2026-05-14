import uuid
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
