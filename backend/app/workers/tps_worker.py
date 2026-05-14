"""
Step 8: Thin Plate Spline deformation (SciPy RBFInterpolator).
Deforms the FLAME mesh so its control points match the skull landmarks + FSTT offsets.
"""
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tps_worker.deform_mesh", bind=True)
def deform_mesh(self, job_id: str) -> dict:
    from app.workers._runner import run_step
    return run_step(job_id, step_number=8, next_task="export_result")
