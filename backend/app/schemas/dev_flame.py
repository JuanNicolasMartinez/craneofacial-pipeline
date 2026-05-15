from pydantic import BaseModel


class FlameMappingRead(BaseModel):
    flame_template: str
    landmark_order: list[str]
    rigid_landmark_labels: list[str]
    mapping: dict[str, int]
    template_vertex_count: int
    template_face_count: int
