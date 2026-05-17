import uuid
from fastapi import APIRouter, Depends, HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.storage import get_storage
from app.models.user import User
from app.schemas.pipeline import (
    PipelineRunRequest,
    PipelineRunResponse,
    PipelineJobRead,
    ResultRead,
)
from app.services import pipeline_service, case_service
from app.models.pipeline_job import JobStep
from sqlalchemy import select

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
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
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
async def list_jobs(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    return case.pipeline_jobs


@router.get("/{case_id}/result", response_model=ResultRead)
async def get_result(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    case = await case_service.get_case(db, case_id, user.id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    reconstruction = await pipeline_service.get_case_result(db, case_id)
    if not reconstruction:
        raise HTTPException(status_code=404, detail="No completed result found")

    step = (
        await db.execute(
            select(JobStep).where(
                JobStep.job_id == reconstruction.job_id,
                JobStep.step_number == 9,
            )
        )
    ).scalar_one_or_none()
    step_params = step.params if step and step.params else {}
    diagnostics = step_params.get("diagnostics") or {}
    diagnostics_summary = {
        key: diagnostics.get(key)
        for key in (
            "candidate_name",
            "blend_alpha",
            "confidence_score",
            "confidence_reasons",
            "robust_rigid_residual_mean_mm",
            "robust_rigid_residual_max_mm",
            "deformed_to_aligned_bbox_ratio",
            "top_rigid_residuals",
            "residual_landmark_weights_by_label",
        )
        if key in diagnostics
    }
    scientific_basis = {
        "model": diagnostics.get("forensic_model_version"),
        "fstt_profile": diagnostics.get("fstt_profile"),
        "fstt_depths_by_label": diagnostics.get("fstt_depths_by_label"),
        "fstt_constraint_tolerances_by_label": diagnostics.get(
            "fstt_constraint_tolerances_by_label"
        ),
        "landmark_region_confidence_by_label": diagnostics.get(
            "landmark_region_confidence_by_label"
        ),
        "normals_source": diagnostics.get("normals_source"),
        "tps_smoothing": diagnostics.get("tps_smoothing"),
    }
    scientific_basis = {
        key: value for key, value in scientific_basis.items() if value is not None
    }

    storage = get_storage()
    return ResultRead(
        job_id=reconstruction.job_id,
        mesh_url=await storage.get_url(reconstruction.r2_key_mesh),
        mesh_url_alt=(
            await storage.get_url(reconstruction.r2_key_mesh_alt)
            if reconstruction.r2_key_mesh_alt
            else None
        ),
        params_url=await storage.get_url(reconstruction.r2_key_params),
        quality_status=step_params.get("quality_status")
        or diagnostics.get("quality_status"),
        warning_message=step_params.get("warning_message")
        or diagnostics.get("warning_message"),
        confidence_score=diagnostics.get("confidence_score"),
        scientific_basis=scientific_basis or None,
        diagnostics_summary=diagnostics_summary or None,
        p2p_error_mm=reconstruction.p2p_error_mm,
        hausdorff_mm=reconstruction.hausdorff_mm,
    )
