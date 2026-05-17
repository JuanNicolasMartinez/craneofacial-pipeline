import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_ref: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="created")
    notes: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="cases")
    meshes: Mapped[list["Mesh"]] = relationship(back_populates="case", lazy="selectin")
    biological_profile: Mapped["BiologicalProfile | None"] = relationship(
        back_populates="case", uselist=False, lazy="selectin"
    )
    landmark_sets: Mapped[list["LandmarkSet"]] = relationship(
        back_populates="case", lazy="selectin"
    )
    pipeline_jobs: Mapped[list["PipelineJob"]] = relationship(
        back_populates="case", lazy="selectin"
    )


from app.models.mesh import Mesh, BiologicalProfile  # noqa: E402, F401
from app.models.landmark import LandmarkSet  # noqa: E402, F401
from app.models.pipeline_job import PipelineJob  # noqa: E402, F401
from app.models.user import User  # noqa: E402, F401
