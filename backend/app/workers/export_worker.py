"""
Step 9: Export result mesh to R2 and write Reconstruction record.
"""
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.export_worker.export_result", bind=True)
def export_result(self, job_id: str) -> dict:
    from app.workers._runner import run_step
    return run_step(job_id, step_number=9, next_task=None)
