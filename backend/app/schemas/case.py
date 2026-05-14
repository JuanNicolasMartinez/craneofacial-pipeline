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


class CaseList(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    case_ref: str
    status: str
    created_by: str
    created_at: datetime
