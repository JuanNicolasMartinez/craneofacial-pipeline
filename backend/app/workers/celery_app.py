from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "craneofacial",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.mesh_worker.preprocess_mesh": {"queue": "mesh_queue"},
        "app.workers.align_worker.align_skull": {"queue": "compute_queue"},
        "app.workers.tps_worker.deform_mesh": {"queue": "compute_queue"},
        "app.workers.export_worker.export_result": {"queue": "export_queue"},
    },
)

celery_app.autodiscover_tasks(
    ["app.workers.mesh_worker", "app.workers.align_worker",
     "app.workers.tps_worker", "app.workers.export_worker"]
)
