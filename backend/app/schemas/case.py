import uuid
from datetime import datetime
from pydantic import BaseModel


class CaseCreate(BaseModel):
    case_ref: str
    notes: str | None = None
    created_by: str


class CaseRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_ref: str
    status: str
    notes: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    # Hydration — populated by GET /cases/{id} for checkpoint resume
    current_step: str = "mesh"
    mesh_id: uuid.UUID | None = None
    mesh_url: str | None = None
    mesh_format: str | None = None
    landmark_set_id: uuid.UUID | None = None
    landmark_count: int = 0
    has_biological_profile: bool = False
    last_job_id: uuid.UUID | None = None
    last_job_status: str | None = None


class CaseList(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_ref: str
    status: str
    created_by: str
    created_at: datetime
    # Light-weight checkpoint for the WelcomeScreen card
    current_step: str = "mesh"
