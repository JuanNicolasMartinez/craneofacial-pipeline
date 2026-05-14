import uuid
from datetime import datetime
from sqlalchemy import String, Text, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PipelineJob(Base):
    __tablename__ = "pipeline_jobs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    landmark_set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("landmark_sets.id")
    )
    celery_task_id: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    fstt_table: Mapped[str] = mapped_column(String(50))
    fstt_k_factor: Mapped[float] = mapped_column(Float, default=0.0)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    case: Mapped["Case"] = relationship(back_populates="pipeline_jobs")
    steps: Mapped[list["JobStep"]] = relationship(
        back_populates="job", lazy="selectin"
    )
    reconstructions: Mapped[list["Reconstruction"]] = relationship(
        back_populates="job", lazy="selectin"
    )


class JobStep(Base):
    __tablename__ = "job_steps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_jobs.id"), index=True
    )
    step_number: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    params: Mapped[dict | None] = mapped_column(JSONB)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)

    job: Mapped["PipelineJob"] = relationship(back_populates="steps")


class Reconstruction(Base):
    __tablename__ = "reconstructions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("pipeline_jobs.id"), index=True
    )
    r2_key_mesh: Mapped[str] = mapped_column(String(500))
    r2_key_params: Mapped[str] = mapped_column(String(500))
    p2p_error_mm: Mapped[float | None] = mapped_column(Float)
    hausdorff_mm: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    job: Mapped["PipelineJob"] = relationship(back_populates="reconstructions")


from app.models.case import Case  # noqa: E402, F401
from app.models.landmark import LandmarkSet  # noqa: E402, F401
