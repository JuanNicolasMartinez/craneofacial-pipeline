import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.pipeline_job import PipelineJob, JobStep, Reconstruction
from app.schemas.pipeline import PipelineRunRequest
from app.core.fstt import FSTT_TABLE_NAME

_STEP_NAMES = {
    1: "ingestion",
    2: "preprocessing",
    3: "landmark_selection",
    4: "biological_profile",
    5: "fstt_vectors",
    6: "flame_loading",
    7: "skull_alignment",
    8: "tps_deformation",
    9: "export",
}


async def create_pipeline_job(
    db: AsyncSession,
    case_id: uuid.UUID,
    data: PipelineRunRequest,
) -> PipelineJob:
    job = PipelineJob(
        case_id=case_id,
        landmark_set_id=data.landmark_set_id,
        fstt_table=FSTT_TABLE_NAME,
        fstt_k_factor=data.fstt_k_factor,
    )
    db.add(job)
    await db.flush()

    for step_num, step_name in _STEP_NAMES.items():
        step = JobStep(
            job_id=job.id,
            step_number=step_num,
            name=step_name,
            status="pending" if step_num > 1 else "done",
        )
        db.add(step)

    await db.commit()
    await db.refresh(job)
    return job


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> PipelineJob | None:
    result = await db.execute(
        select(PipelineJob).where(PipelineJob.id == job_id)
    )
    return result.scalar_one_or_none()


async def update_job_status(
    db: AsyncSession, job_id: uuid.UUID, status: str, error: str | None = None
) -> None:
    job = await get_job(db, job_id)
    if job:
        job.status = status
        if error:
            job.error_message = error
        await db.commit()


async def get_case_result(
    db: AsyncSession, case_id: uuid.UUID
) -> Reconstruction | None:
    latest_job = (
        await db.execute(
            select(PipelineJob)
            .where(PipelineJob.case_id == case_id)
            .order_by(PipelineJob.started_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if latest_job is None or latest_job.status != "completed":
        return None

    result = await db.execute(
        select(Reconstruction)
        .where(Reconstruction.job_id == latest_job.id)
        .order_by(Reconstruction.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
