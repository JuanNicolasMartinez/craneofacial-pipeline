"""
Step 2: Mesh preprocessing (PyMeshLab).
Receives the skull mesh from R2, cleans it, and passes job to align_worker.
"""
import asyncio
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.mesh_worker.preprocess_mesh", bind=True)
def preprocess_mesh(self, job_id: str) -> dict:
    from app.workers._runner import run_step
    return run_step(job_id, step_number=2, next_task="align_skull")
