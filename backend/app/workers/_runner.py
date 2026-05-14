"""
Shared synchronous helper for worker tasks.
Handles DB access, step status updates, and Redis progress publishing.
"""
import asyncio
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.pipeline_job import PipelineJob, JobStep
from app.api.websockets import publish_job_progress

_NEXT_TASK_MAP = {
    "align_skull": "app.workers.align_worker.align_skull",
    "deform_mesh": "app.workers.tps_worker.deform_mesh",
    "export_result": "app.workers.export_worker.export_result",
}


def run_step(job_id: str, step_number: int, next_task: str | None) -> dict:
    return asyncio.get_event_loop().run_until_complete(
        _run_step_async(job_id, step_number, next_task)
    )


async def _run_step_async(
    job_id: str, step_number: int, next_task: str | None
) -> dict:
    from sqlalchemy import select

    job_uuid = uuid.UUID(job_id)
    start = datetime.now(timezone.utc)

    async with SessionLocal() as db:
        result = await db.execute(
            select(JobStep)
            .where(JobStep.job_id == job_uuid, JobStep.step_number == step_number)
        )
        step = result.scalar_one_or_none()
        if step:
            step.status = "running"
            await db.commit()

    await publish_job_progress(
        settings.REDIS_URL,
        job_id,
        {"step": step_number, "status": "running"},
    )

    # TODO: implement actual processing per step
    # step 2 → PyMeshLab; steps 5-7 → Open3D; step 8 → SciPy TPS; step 9 → trimesh export

    duration_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)

    async with SessionLocal() as db:
        result = await db.execute(
            select(JobStep)
            .where(JobStep.job_id == job_uuid, JobStep.step_number == step_number)
        )
        step = result.scalar_one_or_none()
        if step:
            step.status = "done"
            step.duration_ms = duration_ms
            step.completed_at = datetime.now(timezone.utc)
            await db.commit()

        # On final step, mark job and case as completed
        if next_task is None:
            job_result = await db.execute(select(PipelineJob).where(PipelineJob.id == job_uuid))
            job = job_result.scalar_one_or_none()
            if job:
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc)
                from app.models.case import Case
                case_result = await db.execute(select(Case).where(Case.id == job.case_id))
                case = case_result.scalar_one_or_none()
                if case:
                    case.status = "completed"
                await db.commit()

    await publish_job_progress(
        settings.REDIS_URL,
        job_id,
        {"step": step_number, "status": "done", "duration_ms": duration_ms},
    )

    if next_task:
        from celery import current_app as celery_app

        celery_app.send_task(
            _NEXT_TASK_MAP[next_task],
            args=[job_id],
            queue="compute_queue" if next_task in ("align_skull", "deform_mesh") else "export_queue",
        )

    return {"job_id": job_id, "step": step_number, "status": "done"}
