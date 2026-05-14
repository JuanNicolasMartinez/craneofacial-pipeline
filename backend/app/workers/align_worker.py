"""
Steps 5-7: FSTT vectors, FLAME loading, skull-to-face alignment (Open3D).
"""
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.align_worker.align_skull", bind=True)
def align_skull(self, job_id: str) -> dict:
    from app.workers._runner import run_step
    return run_step(job_id, step_number=7, next_task="deform_mesh")
