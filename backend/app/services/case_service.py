import uuid
from dataclasses import dataclass

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import get_storage
from app.models.case import Case
from app.models.mesh import Mesh, BiologicalProfile
from app.models.landmark import LandmarkSet, Landmark
from app.models.pipeline_job import PipelineJob
from app.schemas.case import CaseCreate


# Steps user-facing in the UI sub-nav
STEP_MESH = "mesh"
STEP_LANDMARKS = "landmarks"
STEP_BIOLOGICAL_PROFILE = "biological_profile"
STEP_PIPELINE = "pipeline"
STEP_RESULT = "result"


@dataclass
class CaseHydration:
    """Snapshot of a case's progress, used to drive UI checkpoint resume."""
    current_step: str
    mesh_id: uuid.UUID | None
    mesh_url: str | None
    mesh_format: str | None
    landmark_set_id: uuid.UUID | None
    landmark_count: int
    has_biological_profile: bool
    last_job_id: uuid.UUID | None
    last_job_status: str | None


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


async def hydrate_case(db: AsyncSession, case_id: uuid.UUID) -> CaseHydration:
    """
    Inspects related rows and computes the resume checkpoint. Single round-trip
    of small queries — no joins needed since each fetch is bounded (1 row).
    """
    storage = get_storage()

    mesh = (
        await db.execute(
            select(Mesh).where(Mesh.case_id == case_id).order_by(Mesh.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    landmark_set = (
        await db.execute(
            select(LandmarkSet)
            .where(LandmarkSet.case_id == case_id)
            .order_by(LandmarkSet.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    landmark_count = 0
    if landmark_set:
        landmark_count = (
            await db.execute(
                select(func.count(Landmark.id)).where(Landmark.set_id == landmark_set.id)
            )
        ).scalar_one()

    profile = (
        await db.execute(
            select(BiologicalProfile).where(BiologicalProfile.case_id == case_id)
        )
    ).scalar_one_or_none()

    last_job = (
        await db.execute(
            select(PipelineJob)
            .where(PipelineJob.case_id == case_id)
            .order_by(PipelineJob.started_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    mesh_url = await storage.get_url(mesh.r2_key) if mesh else None

    # Checkpoint logic — lands the user at the first incomplete step.
    if mesh is None:
        current_step = STEP_MESH
    elif landmark_count < 21:
        current_step = STEP_LANDMARKS
    elif profile is None:
        current_step = STEP_BIOLOGICAL_PROFILE
    elif last_job is None or last_job.status != "completed":
        current_step = STEP_PIPELINE
    else:
        current_step = STEP_RESULT

    return CaseHydration(
        current_step=current_step,
        mesh_id=mesh.id if mesh else None,
        mesh_url=mesh_url,
        mesh_format=mesh.format if mesh else None,
        landmark_set_id=landmark_set.id if landmark_set else None,
        landmark_count=landmark_count,
        has_biological_profile=profile is not None,
        last_job_id=last_job.id if last_job else None,
        last_job_status=last_job.status if last_job else None,
    )
