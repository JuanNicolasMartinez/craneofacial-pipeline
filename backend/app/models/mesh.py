import uuid
from datetime import datetime
from sqlalchemy import String, BigInteger, Integer, Float, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class Mesh(Base):
    __tablename__ = "meshes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id"), index=True)
    r2_key: Mapped[str] = mapped_column(String(500))
    format: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="uploaded")
    vertex_count: Mapped[int | None] = mapped_column(Integer)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="meshes")


class BiologicalProfile(Base):
    __tablename__ = "biological_profiles"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("cases.id"), unique=True, index=True
    )
    sex: Mapped[str] = mapped_column(String(1))
    ancestry: Mapped[str] = mapped_column(String(30))
    age_range: Mapped[str] = mapped_column(String(10))
    confidence: Mapped[float] = mapped_column(Float)
    fstt_table: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="biological_profile")


from app.models.case import Case  # noqa: E402, F401
