"""
Shared synchronous helper for worker tasks.
Handles DB access, step status updates, and Redis progress publishing.
"""
import asyncio
import json
import uuid
from datetime import datetime, timezone

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.storage import get_storage
from app.models.pipeline_job import PipelineJob, JobStep, Reconstruction
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
    from app.models.case import Case

    job_uuid = uuid.UUID(job_id)
    start = datetime.now(timezone.utc)

    if step_number == 7:
        await _complete_automatic_steps(job_uuid, [5, 6], job_id)

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

    step_params: dict | None = None

    try:
        # Step 9 still performs the CPU-heavy reconstruction in one pass so we
        # avoid serializing large intermediate meshes between queues. Earlier
        # automatic steps validate prerequisites and keep the user-facing
        # timeline honest.
        if step_number == 2:
            step_params = await _preprocess_mesh(job_uuid)
        elif step_number == 7:
            step_params = {
                "stage": "alignment_preflight",
                "computed_in_step": 9,
            }
        elif step_number == 8:
            step_params = {
                "stage": "regularized_tps_preflight",
                "computed_in_step": 9,
            }
        elif step_number == 9:
            step_params = await _export_result(job_uuid)

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
                if step_params:
                    step.params = {
                        **(step.params or {}),
                        **step_params,
                    }

            if next_task is None:
                job_result = await db.execute(
                    select(PipelineJob).where(PipelineJob.id == job_uuid)
                )
                job = job_result.scalar_one_or_none()
                if job:
                    job.status = "completed"
                    job.completed_at = datetime.now(timezone.utc)

                    case_result = await db.execute(
                        select(Case).where(Case.id == job.case_id)
                    )
                    case = case_result.scalar_one_or_none()
                    if case:
                        case.status = "completed"

            await db.commit()

        done_payload = {"step": step_number, "status": "done", "duration_ms": duration_ms}
        if step_params:
            for key in (
                "vertex_count",
                "face_count",
                "quality_status",
                "warning_message",
            ):
                if key in step_params:
                    done_payload[key] = step_params[key]

        await publish_job_progress(settings.REDIS_URL, job_id, done_payload)

        if next_task:
            from celery import current_app as celery_app

            celery_app.send_task(
                _NEXT_TASK_MAP[next_task],
                args=[job_id],
                queue=(
                    "compute_queue"
                    if next_task in ("align_skull", "deform_mesh")
                    else "export_queue"
                ),
            )

        return {"job_id": job_id, "step": step_number, "status": "done"}

    except Exception as exc:
        error_message = str(exc) or exc.__class__.__name__
        completed_at = datetime.now(timezone.utc)
        duration_ms = int((completed_at - start).total_seconds() * 1000)
        diagnostics = getattr(exc, "diagnostics", None)

        async with SessionLocal() as db:
            result = await db.execute(
                select(JobStep)
                .where(JobStep.job_id == job_uuid, JobStep.step_number == step_number)
            )
            step = result.scalar_one_or_none()
            if step:
                step.status = "error"
                step.duration_ms = duration_ms
                step.completed_at = completed_at
                step.params = {
                    **(step.params or {}),
                    "error": error_message,
                    **({"diagnostics": diagnostics} if diagnostics else {}),
                }

            job_result = await db.execute(
                select(PipelineJob).where(PipelineJob.id == job_uuid)
            )
            job = job_result.scalar_one_or_none()
            if job:
                job.status = "error"
                job.error_message = error_message
                job.completed_at = completed_at

                case_result = await db.execute(
                    select(Case).where(Case.id == job.case_id)
                )
                case = case_result.scalar_one_or_none()
                if case:
                    case.status = "error"

            await db.commit()

        await publish_job_progress(
            settings.REDIS_URL,
            job_id,
            {"step": step_number, "status": "error", "error": error_message},
        )
        raise


async def _complete_automatic_steps(
    job_uuid: uuid.UUID,
    step_numbers: list[int],
    job_id: str,
) -> None:
    """Mark lightweight conceptual steps done before the heavy reconstruction."""
    from sqlalchemy import select

    completed_at = datetime.now(timezone.utc)
    async with SessionLocal() as db:
        for step_number in step_numbers:
            result = await db.execute(
                select(JobStep)
                .where(
                    JobStep.job_id == job_uuid,
                    JobStep.step_number == step_number,
                )
            )
            step = result.scalar_one_or_none()
            if not step or step.status in {"done", "error"}:
                continue
            step.status = "done"
            step.duration_ms = 0
            step.completed_at = completed_at
            step.params = {
                **(step.params or {}),
                "stage": step.name,
                "computed_in_step": 9,
            }
        await db.commit()

    for step_number in step_numbers:
        await publish_job_progress(
            settings.REDIS_URL,
            job_id,
            {"step": step_number, "status": "done", "duration_ms": 0},
        )


async def _preprocess_mesh(job_uuid: uuid.UUID) -> dict:
    """
    Step 2: validate and canonicalize the active skull mesh without changing
    coordinate scale, preserving already placed landmarks.
    """
    from sqlalchemy import select
    from app.models.mesh import Mesh

    storage = get_storage()

    async with SessionLocal() as db:
        job = (
            await db.execute(select(PipelineJob).where(PipelineJob.id == job_uuid))
        ).scalar_one_or_none()
        if not job:
            raise ValueError(f"Pipeline job {job_uuid} not found")

        mesh = (
            await db.execute(
                select(Mesh)
                .where(Mesh.case_id == job.case_id)
                .order_by(Mesh.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not mesh:
            raise ValueError(f"No source mesh found for case {job.case_id}")

        source_key = mesh.r2_key
        source_format = mesh.format
        case_id = job.case_id

    source_bytes = await storage.download(source_key)

    loop = asyncio.get_event_loop()
    prepared_bytes, params = await loop.run_in_executor(
        None,
        lambda: prepare_mesh_for_pipeline(source_bytes, source_format, source_key),
    )
    preprocessed_key = f"meshes/{case_id}/preprocessed/{job_uuid}.ply"
    await storage.upload(preprocessed_key, prepared_bytes, content_type="model/ply")

    async with SessionLocal() as db:
        mesh = (
            await db.execute(
                select(Mesh)
                .where(Mesh.case_id == case_id)
                .order_by(Mesh.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        if not mesh:
            raise ValueError(f"No source mesh found for case {case_id}")
        mesh.r2_key = preprocessed_key
        mesh.format = "ply"
        mesh.status = "preprocessed"
        mesh.vertex_count = params["vertex_count"]
        mesh.file_size_bytes = len(prepared_bytes)
        await db.commit()

    return {
        **params,
        "preprocessed_key": preprocessed_key,
    }


def prepare_mesh_for_pipeline(
    source_bytes: bytes,
    source_format: str,
    source_key: str,
) -> tuple[bytes, dict]:
    """Return a canonical PLY plus metadata while preserving coordinates."""
    import trimesh

    skull = trimesh.load(
        trimesh.util.wrap_as_stream(source_bytes),
        file_type=source_format,
        process=False,
    )
    if isinstance(skull, trimesh.Scene):
        skull = skull.dump(concatenate=True)
    if not isinstance(skull, trimesh.Trimesh):
        raise ValueError(f"Unsupported skull mesh type: {type(skull)!r}")
    if len(skull.vertices) == 0 or len(skull.faces) == 0:
        raise ValueError("Skull mesh is empty")

    prepared = skull.copy()
    before_vertices = int(len(prepared.vertices))
    before_faces = int(len(prepared.faces))
    before_bbox = prepared.bounds.tolist()

    if hasattr(prepared, "nondegenerate_faces"):
        prepared.update_faces(prepared.nondegenerate_faces())
    elif hasattr(prepared, "remove_degenerate_faces"):
        prepared.remove_degenerate_faces()
    prepared.remove_unreferenced_vertices()
    prepared.fix_normals()
    _ = prepared.vertex_normals

    payload = prepared.export(file_type="ply")
    if isinstance(payload, str):
        payload = payload.encode("utf-8")

    params = {
        "source_key": source_key,
        "preprocessed_format": "ply",
        "vertex_count_before": before_vertices,
        "face_count_before": before_faces,
        "vertex_count": int(len(prepared.vertices)),
        "face_count": int(len(prepared.faces)),
        "bbox_before": before_bbox,
        "bbox_after": prepared.bounds.tolist(),
        "preserves_coordinate_system": True,
    }
    return payload, params


async def _export_result(job_uuid: uuid.UUID) -> dict:
    """
    Step 9: Run the single FLAME reconstruction and store the result.
    Writes a Reconstruction row plus a params.json with the FSTT config used.
    """
    import asyncio
    from sqlalchemy import select
    from app.models.mesh import Mesh, BiologicalProfile
    from app.models.landmark import Landmark as LM
    from app.core.reconstruction import (
        LandmarkPoint,
        NORMALS_SOURCE,
        TPS_SMOOTHING,
        reconstruct_flame_with_metadata,
    )
    from app.core.config import settings as _s

    storage = get_storage()

    async with SessionLocal() as db:
        job = (await db.execute(select(PipelineJob).where(PipelineJob.id == job_uuid))).scalar_one_or_none()
        if not job:
            raise ValueError(f"Pipeline job {job_uuid} not found")

        mesh = (
            await db.execute(
                select(Mesh).where(Mesh.case_id == job.case_id).order_by(Mesh.created_at.desc()).limit(1)
            )
        ).scalar_one_or_none()
        if not mesh:
            raise ValueError(f"No source mesh found for case {job.case_id}")

        # Load biological profile for FSTT lookup
        bio = (
            await db.execute(
                select(BiologicalProfile).where(BiologicalProfile.case_id == job.case_id)
            )
        ).scalar_one_or_none()
        sex = bio.sex if bio else "M"
        ancestry = bio.ancestry if bio else "global"
        age_range = bio.age_range if bio else "18-35"

        # Load landmarks for this job's landmark set
        lm_rows = (
            await db.execute(
                select(LM).where(LM.set_id == job.landmark_set_id)
            )
        ).scalars().all()
        landmarks = [
            LandmarkPoint(
                label=lm.label,
                x=float(lm.x), y=float(lm.y), z=float(lm.z),
                nx=float(lm.nx), ny=float(lm.ny), nz=float(lm.nz),
            )
            for lm in lm_rows
        ]

    # Download skull mesh bytes
    source_bytes = await storage.download(mesh.r2_key)

    # Run reconstruction in a thread (CPU-bound).
    loop = asyncio.get_event_loop()
    flame_result = await loop.run_in_executor(
        None,
        lambda: reconstruct_flame_with_metadata(
            skull_mesh_bytes=source_bytes,
            mesh_format=mesh.format,
            landmarks=landmarks,
            sex=sex,
            ancestry=ancestry,
            age_range=age_range,
            fstt_k_factor=job.fstt_k_factor,
            flame_model_path=_s.FLAME_MODEL_PATH,
        ),
    )

    flame_key = f"results/{job.id}/result_flame.ply"
    params_key = f"results/{job.id}/params.json"
    reconstruction_method = flame_result.diagnostics.get(
        "method",
        "forensic_v1_soft_fstt_flame_prior",
    )
    step_params = {
        "method": reconstruction_method,
        "forensic_model_version": flame_result.diagnostics.get(
            "forensic_model_version",
            "forensic_v1_soft_fstt_flame_prior",
        ),
        "flame_template": _s.FLAME_MODEL_PATH.rsplit("/", 1)[-1],
        "tps_smoothing": TPS_SMOOTHING,
        "normals_source": NORMALS_SOURCE,
        "procrustes_scale": flame_result.procrustes_scale,
        "quality_status": flame_result.diagnostics.get("quality_status", "ok"),
        "confidence_score": flame_result.diagnostics.get("confidence_score"),
        "warning_message": flame_result.diagnostics.get("warning_message"),
        "selected_candidate": flame_result.diagnostics.get("candidate_name"),
        "blend_alpha": flame_result.diagnostics.get("blend_alpha"),
        "diagnostics": flame_result.diagnostics,
    }
    params_payload = json.dumps(
        {
            "job_id": str(job.id),
            "case_id": str(job.case_id),
            "fstt_table": job.fstt_table,
            "fstt_k_factor": job.fstt_k_factor,
            "sex": sex,
            "ancestry": ancestry,
            "age_range": age_range,
            "n_landmarks": len(landmarks),
            "source_mesh_format": mesh.format,
            "method": reconstruction_method,
            "forensic_model_version": flame_result.diagnostics.get(
                "forensic_model_version",
                "forensic_v1_soft_fstt_flame_prior",
            ),
            "flame_template": _s.FLAME_MODEL_PATH.rsplit("/", 1)[-1],
            "tps_smoothing": TPS_SMOOTHING,
            "normals_source": NORMALS_SOURCE,
            "procrustes_scale": flame_result.procrustes_scale,
            "quality_status": flame_result.diagnostics.get("quality_status", "ok"),
            "confidence_score": flame_result.diagnostics.get("confidence_score"),
            "warning_message": flame_result.diagnostics.get("warning_message"),
            "selected_candidate": flame_result.diagnostics.get("candidate_name"),
            "blend_alpha": flame_result.diagnostics.get("blend_alpha"),
            "diagnostics": flame_result.diagnostics,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        indent=2,
    ).encode("utf-8")

    await storage.upload(flame_key, flame_result.ply_bytes, content_type="model/ply")
    await storage.upload(params_key, params_payload, content_type="application/json")

    async with SessionLocal() as db:
        existing = (
            await db.execute(select(Reconstruction).where(Reconstruction.job_id == job_uuid))
        ).scalar_one_or_none()
        if existing:
            existing.r2_key_mesh = flame_key
            existing.r2_key_mesh_alt = None
            existing.r2_key_params = params_key
        else:
            db.add(
                Reconstruction(
                    job_id=job_uuid,
                    r2_key_mesh=flame_key,
                    r2_key_mesh_alt=None,
                    r2_key_params=params_key,
                )
            )
        await db.commit()

    return step_params
