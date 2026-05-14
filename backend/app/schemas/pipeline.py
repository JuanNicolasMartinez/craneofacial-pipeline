import uuid
from datetime import datetime
from pydantic import BaseModel


class PipelineRunRequest(BaseModel):
    landmark_set_id: uuid.UUID
    fstt_k_factor: float = 0.0


class PipelineRunResponse(BaseModel):
    job_id: uuid.UUID
    status: str


class JobStepRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    step_number: int
    name: str
    status: str
    duration_ms: int | None
    completed_at: datetime | None


class ReconstructionRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    job_id: uuid.UUID
    r2_key_mesh: str
    r2_key_params: str
    p2p_error_mm: float | None
    hausdorff_mm: float | None
    created_at: datetime


class PipelineJobRead(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_id: uuid.UUID
    status: str
    fstt_table: str
    fstt_k_factor: float
    error_message: str | None
    started_at: datetime
    completed_at: datetime | None
    steps: list[JobStepRead]
    reconstructions: list[ReconstructionRead]


class ResultRead(BaseModel):
    job_id: uuid.UUID
    mesh_url: str
    params_url: str
    p2p_error_mm: float | None
    hausdorff_mm: float | None
