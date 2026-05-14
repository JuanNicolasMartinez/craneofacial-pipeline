import uuid
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.pipeline import (
    PipelineRunRequest,
    PipelineRunResponse,
    PipelineJobRead,
    ResultRead,
)
from app.services import pipeline_service, case_service

router = APIRouter(prefix="/cases", tags=["pipeline"])


@router.post(
    "/{case_id}/pipeline/run",
    response_model=PipelineRunResponse,
    status_code=http_status.HTTP_202_ACCEPTED,
)
async def run_pipeline(
    case_id: uuid.UUID,
    data: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    job = await pipeline_service.create_pipeline_job(db, case_id, data)
    await case_service.update_case_status(db, case_id, "running")

    # Dispatch Celery task (imported here to avoid circular import at startup)
    from app.workers.mesh_worker import preprocess_mesh

    celery_result = preprocess_mesh.apply_async(
        args=[str(job.id)],
        queue="mesh_queue",
    )

    job.celery_task_id = celery_result.id
    await db.commit()

    return PipelineRunResponse(job_id=job.id, status=job.status)


@router.get("/{case_id}/pipeline/jobs", response_model=list[PipelineJobRead])
async def list_jobs(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    case = await case_service.get_case(db, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case.pipeline_jobs


@router.get("/{case_id}/result", response_model=ResultRead)
async def get_result(case_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    reconstruction = await pipeline_service.get_case_result(db, case_id)
    if not reconstruction:
        raise HTTPException(status_code=404, detail="No completed result found")

    # In production, generate presigned R2 URLs here.
    return ResultRead(
        job_id=reconstruction.job_id,
        mesh_url=f"/dev-assets/{reconstruction.r2_key_mesh}",
        params_url=f"/dev-assets/{reconstruction.r2_key_params}",
        p2p_error_mm=reconstruction.p2p_error_mm,
        hausdorff_mm=reconstruction.hausdorff_mm,
    )
