import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.mesh import Mesh, BiologicalProfile
from app.schemas.mesh import BiologicalProfileCreate
from app.core.fstt import get_fstt_vector, FSTT_TABLE_NAME


async def create_mesh_record(
    db: AsyncSession,
    case_id: uuid.UUID,
    r2_key: str,
    fmt: str,
    file_size_bytes: int,
) -> Mesh:
    mesh = Mesh(
        case_id=case_id,
        r2_key=r2_key,
        format=fmt,
        file_size_bytes=file_size_bytes,
    )
    db.add(mesh)
    await db.commit()
    await db.refresh(mesh)
    return mesh


async def get_active_mesh(db: AsyncSession, case_id: uuid.UUID) -> Mesh | None:
    result = await db.execute(
        select(Mesh)
        .where(Mesh.case_id == case_id)
        .order_by(Mesh.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def upsert_biological_profile(
    db: AsyncSession,
    case_id: uuid.UUID,
    data: BiologicalProfileCreate,
) -> BiologicalProfile:
    result = await db.execute(
        select(BiologicalProfile).where(BiologicalProfile.case_id == case_id)
    )
    profile = result.scalar_one_or_none()

    fstt_table = FSTT_TABLE_NAME
    if profile:
        profile.sex = data.sex
        profile.ancestry = data.ancestry
        profile.age_range = data.age_range
        profile.confidence = data.confidence
        profile.fstt_table = fstt_table
    else:
        profile = BiologicalProfile(
            case_id=case_id,
            **data.model_dump(),
            fstt_table=fstt_table,
        )
        db.add(profile)

    await db.commit()
    await db.refresh(profile)
    return profile
