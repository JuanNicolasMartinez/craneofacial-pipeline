import io

import trimesh
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.flame_landmarks import (
    FLAME_LANDMARK_VERTICES,
    LANDMARK_ORDER,
    RIGID_PROCRUSTES_LABELS,
)
from app.core.reconstruction import load_flame_template
from app.schemas.dev_flame import FlameMappingRead

router = APIRouter(prefix="/dev/flame", tags=["dev-flame"])


@router.get("/mapping", response_model=FlameMappingRead)
async def get_flame_mapping() -> FlameMappingRead:
    vertices, faces = load_flame_template(settings.FLAME_MODEL_PATH)
    return FlameMappingRead(
        flame_template=settings.FLAME_MODEL_PATH.rsplit("/", 1)[-1],
        landmark_order=list(LANDMARK_ORDER),
        rigid_landmark_labels=list(RIGID_PROCRUSTES_LABELS),
        mapping=dict(FLAME_LANDMARK_VERTICES),
        template_vertex_count=len(vertices),
        template_face_count=len(faces),
    )


@router.get("/template.ply")
async def get_flame_template_ply() -> StreamingResponse:
    vertices, faces = load_flame_template(settings.FLAME_MODEL_PATH)
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    payload = mesh.export(file_type="ply")
    if isinstance(payload, str):
        payload = payload.encode("utf-8")
    headers = {"Content-Disposition": 'inline; filename="flame_template.ply"'}
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="model/ply",
        headers=headers,
    )
