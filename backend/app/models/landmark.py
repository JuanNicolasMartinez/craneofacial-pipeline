import uuid
from datetime import datetime
from sqlalchemy import String, Float, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class LandmarkSet(Base):
    __tablename__ = "landmark_sets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    protocol: Mapped[str] = mapped_column(String(30), default="Rhine-Campbell-1980")
    operator: Mapped[str] = mapped_column(String(100))
    mean_inter_operator_dist_mm: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="landmark_sets")
    landmarks: Mapped[list["Landmark"]] = relationship(
        back_populates="landmark_set", lazy="selectin"
    )


class Landmark(Base):
    __tablename__ = "landmarks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    set_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("landmark_sets.id"), index=True
    )
    label: Mapped[str] = mapped_column(String(50))
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    z: Mapped[float] = mapped_column(Float)
    nx: Mapped[float] = mapped_column(Float)
    ny: Mapped[float] = mapped_column(Float)
    nz: Mapped[float] = mapped_column(Float)

    landmark_set: Mapped["LandmarkSet"] = relationship(back_populates="landmarks")


from app.models.case import Case  # noqa: E402, F401
