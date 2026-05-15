"""
Step 2: conservative mesh preprocessing with trimesh.
Receives the skull mesh from storage, canonicalizes it as PLY without changing
coordinates, and passes the job to align_worker.
"""
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.mesh_worker.preprocess_mesh", bind=True)
def preprocess_mesh(self, job_id: str) -> dict:
    from app.workers._runner import run_step
    return run_step(job_id, step_number=2, next_task="align_skull")
