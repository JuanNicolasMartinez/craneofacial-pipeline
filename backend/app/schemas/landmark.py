import uuid
from datetime import datetime
from pydantic import BaseModel


class LandmarkIn(BaseModel):
    label: str
    x: float
    y: float
    z: float
    nx: float
    ny: float
    nz: float


class LandmarkSetCreate(BaseModel):
    operator: str
    landmarks: list[LandmarkIn]


class LandmarkRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    set_id: uuid.UUID
    label: str
    x: float
    y: float
    z: float
    nx: float
    ny: float
    nz: float


class LandmarkSetRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_id: uuid.UUID
    protocol: str
    operator: str
    mean_inter_operator_dist_mm: float | None
    created_at: datetime
    landmarks: list[LandmarkRead]
