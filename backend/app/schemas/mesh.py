import uuid
from datetime import datetime
from pydantic import BaseModel


class MeshRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_id: uuid.UUID
    r2_key: str
    format: str
    status: str
    vertex_count: int | None
    file_size_bytes: int
    created_at: datetime


class BiologicalProfileCreate(BaseModel):
    sex: str
    ancestry: str
    age_range: str
    confidence: float = 1.0


class BiologicalProfileRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_id: uuid.UUID
    sex: str
    ancestry: str
    age_range: str
    confidence: float
    fstt_table: str
    created_at: datetime
