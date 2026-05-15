"""
Craniofacial reconstruction helpers.

Current reconstruction strategy:
  1. Recompute landmark normals from the real skull mesh.
  2. Build 21 facial control points with FSTT offsets.
  3. Align the FLAME template with a rigid-subset similarity transform.
  4. Stabilize posterior regions with identity anchors.
  5. Apply a regularized TPS warp.
  6. Fall back to bounded deformation or Procrustes-only FLAME when the
     full TPS is anatomically low-confidence, so a human-shaped face is
     still exported.

The frontend still submits landmark normals for compatibility, but the backend
does not trust them for reconstruction.
"""
from __future__ import annotations

import logging
import pickle
import sys
import types
from collections import Counter
from typing import Any, NamedTuple

import numpy as np
import trimesh
from scipy.interpolate import RBFInterpolator
from scipy.optimize import least_squares
from scipy.spatial import cKDTree

from app.core.flame_landmarks import (
    FLAME_LANDMARK_VERTICES,
    LANDMARK_ORDER,
    RIGID_PROCRUSTES_LABELS,
    validate_flame_landmark_mapping,
)

log = logging.getLogger(__name__)

TPS_SMOOTHING = 100.0
NORMALS_SOURCE = "nearest_skull_vertex_normal"
STABILIZATION_ANCHOR_COUNT = 32
STABILIZATION_TOP_DISTANCE_QUANTILE = 0.60

MAX_RIGID_RESIDUAL_MEAN_MM = 4.5
MAX_RIGID_RESIDUAL_MAX_MM = 8.0
MIN_BBOX_RATIO = 0.55
MAX_BBOX_RATIO = 1.75

TPS_BLEND_FACTORS = (1.0, 0.65, 0.4, 0.2, 0.0)
MIN_HUMAN_BBOX_RATIO_TO_ALIGNED = 0.68
MAX_HUMAN_BBOX_RATIO_TO_ALIGNED = 1.48
MAX_HUMAN_DISPLACEMENT_P95_RATIO = 0.42

FLAME_SHAPE_COMPONENTS = 20
FLAME_SHAPE_BETA_BOUND = 1.6
FLAME_SHAPE_PRIOR_WEIGHT_MM = 6.5
FLAME_SHAPE_LOSS_SCALE_MM = 4.0
ROBUST_RIGID_MIN_INLIERS = 8
ROBUST_LANDMARK_SCALE_MM = 6.0
ROBUST_LANDMARK_MIN_WEIGHT = 0.08
RESIDUAL_DISPLACEMENT_MAX_MM = 10.0
RESIDUAL_DISPLACEMENT_MAX_SPAN_RATIO = 0.07
RESIDUAL_DISPLACEMENT_FALLOFF_RATIO = 0.28
RESIDUAL_DISPLACEMENT_FALLOFF_FLOOR = 0.08
SURFACE_SMOOTHING_ITERATIONS = 4

# These are solver confidence/tolerance values, not replacement FSTT tables.
# They encode the practical forensic stance that landmarks/FSTT guide the face
# statistically, while FLAME preserves the human prior when observations clash.
FSTT_CONSTRAINT_TOLERANCE_MM: dict[str, float] = {
    "supraglabella": 4.0,
    "glabella": 4.0,
    "nasion": 4.0,
    "end_of_nasal_bone": 4.5,
    "mid_philtrum": 6.0,
    "upper_lip_margin": 7.0,
    "lower_lip_margin": 7.0,
    "chin_lip_fold": 5.0,
    "mental_eminence": 4.5,
    "beneath_chin": 5.0,
    "right_supraorbital": 6.0,
    "right_suborbital": 6.5,
    "right_lateral_orbit": 7.5,
    "right_zygomatic_arch": 8.0,
    "right_zygomatic": 8.0,
    "right_masseter_muscle": 10.0,
    "right_gonion": 8.0,
    "right_supra_M2": 10.0,
    "right_occlusal_line": 10.0,
    "right_inferior_malar": 8.0,
    "temporal_fossa": 9.0,
}

LANDMARK_REGION_CONFIDENCE: dict[str, float] = {
    "supraglabella": 1.0,
    "glabella": 1.0,
    "nasion": 1.0,
    "end_of_nasal_bone": 0.9,
    "mid_philtrum": 0.75,
    "upper_lip_margin": 0.62,
    "lower_lip_margin": 0.62,
    "chin_lip_fold": 0.85,
    "mental_eminence": 0.95,
    "beneath_chin": 0.9,
    "right_supraorbital": 0.72,
    "right_suborbital": 0.68,
    "right_lateral_orbit": 0.58,
    "right_zygomatic_arch": 0.55,
    "right_zygomatic": 0.55,
    "right_masseter_muscle": 0.42,
    "right_gonion": 0.62,
    "right_supra_M2": 0.42,
    "right_occlusal_line": 0.42,
    "right_inferior_malar": 0.52,
    "temporal_fossa": 0.38,
}


# ---------------------------------------------------------------------------
# FLAME loading
# ---------------------------------------------------------------------------

def _make_chumpy_stub() -> None:
    """Inject a minimal chumpy stub so the FLAME pkl can be unpickled."""
    if "chumpy" in sys.modules:
        return

    class Ch:
        def __init__(self, *a, **kw):
            pass

    chumpy = types.ModuleType("chumpy")
    chumpy_ch = types.ModuleType("chumpy.ch")
    chumpy.Ch = Ch
    chumpy.ch = chumpy_ch
    chumpy_ch.Ch = Ch
    sys.modules["chumpy"] = chumpy
    sys.modules["chumpy.ch"] = chumpy_ch


def _count_face_components(faces: np.ndarray) -> int:
    """Count connected face components without depending on networkx."""
    faces = np.asarray(faces, dtype=np.int32)
    if faces.ndim != 2 or faces.shape[1] != 3:
        raise ValueError(f"Expected triangular faces, got {faces.shape}")
    if len(faces) == 0:
        return 0

    parent = list(range(len(faces)))
    rank = [0] * len(faces)

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        root_left = find(left)
        root_right = find(right)
        if root_left == root_right:
            return
        if rank[root_left] < rank[root_right]:
            parent[root_left] = root_right
        elif rank[root_left] > rank[root_right]:
            parent[root_right] = root_left
        else:
            parent[root_right] = root_left
            rank[root_left] += 1

    vertex_to_faces: dict[int, list[int]] = {}
    for face_index, face in enumerate(faces):
        for vertex in face:
            vertex_to_faces.setdefault(int(vertex), []).append(face_index)

    for face_indices in vertex_to_faces.values():
        base = face_indices[0]
        for other in face_indices[1:]:
            union(base, other)

    return len({find(index) for index in range(len(faces))})


def _extract_largest_face_component(
    vertices: np.ndarray,
    faces: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Keep the largest connected face component and reindex its vertices.

    The bundled FLAME template includes two small detached components that are
    not useful for craniofacial reconstruction. Trimming them up front gives us
    a single-surface template and keeps the exported result cleaner.
    """
    trimmed_vertices, reindexed_faces, _ = _extract_largest_face_component_with_indices(
        vertices,
        faces,
    )
    return trimmed_vertices, reindexed_faces


def _extract_largest_face_component_with_indices(
    vertices: np.ndarray,
    faces: np.ndarray,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Largest face component plus source vertex indices used for blendshapes."""
    faces = np.asarray(faces, dtype=np.int32)
    vertices = np.asarray(vertices, dtype=np.float64)
    if len(faces) == 0:
        raise ValueError("FLAME template has no faces")

    parent = list(range(len(faces)))
    rank = [0] * len(faces)

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left: int, right: int) -> None:
        root_left = find(left)
        root_right = find(right)
        if root_left == root_right:
            return
        if rank[root_left] < rank[root_right]:
            parent[root_left] = root_right
        elif rank[root_left] > rank[root_right]:
            parent[root_right] = root_left
        else:
            parent[root_right] = root_left
            rank[root_left] += 1

    vertex_to_faces: dict[int, list[int]] = {}
    for face_index, face in enumerate(faces):
        for vertex in face:
            vertex_to_faces.setdefault(int(vertex), []).append(face_index)

    for face_indices in vertex_to_faces.values():
        base = face_indices[0]
        for other in face_indices[1:]:
            union(base, other)

    components: dict[int, list[int]] = {}
    for face_index in range(len(faces)):
        components.setdefault(find(face_index), []).append(face_index)

    largest_face_indices = max(components.values(), key=len)
    largest_faces = faces[np.asarray(largest_face_indices, dtype=np.int32)]

    used_vertices = np.unique(largest_faces.reshape(-1))
    index_map = {
        int(old_index): new_index
        for new_index, old_index in enumerate(used_vertices.tolist())
    }
    reindexed_faces = np.vectorize(index_map.__getitem__)(largest_faces).astype(
        np.int32
    )
    trimmed_vertices = vertices[used_vertices]
    return trimmed_vertices, reindexed_faces, used_vertices


def load_flame_template(model_path: str) -> tuple[np.ndarray, np.ndarray]:
    """
    Returns the neutral FLAME mean-shape trimmed to its largest surface.
    vertices: (N, 3) float64 — in FLAME's native unit (~meters)
    faces:    (M, 3) int32
    """
    _make_chumpy_stub()
    with open(model_path, "rb") as f:
        model = pickle.load(f, encoding="latin1")

    vertices = np.array(model["v_template"], dtype=np.float64)
    faces = np.array(model["f"], dtype=np.int32)
    vertices, faces = _extract_largest_face_component(vertices, faces)

    mapping = validate_flame_landmark_mapping(FLAME_LANDMARK_VERTICES)
    max_index = len(vertices) - 1
    for label, vertex_index in mapping.items():
        if vertex_index > max_index:
            raise ValueError(
                f"FLAME landmark {label!r} points outside the trimmed template: "
                f"{vertex_index} > {max_index}"
            )

    return vertices, faces


def load_flame_shape_basis(
    model_path: str,
    *,
    components: int = FLAME_SHAPE_COMPONENTS,
) -> np.ndarray | None:
    """
    Return FLAME shape blendshapes trimmed to the exported template component.

    The bundled FLAME model stores shapedirs as a chumpy object whose dense
    array is available as `.x` after unpickling with our minimal stub.
    """
    _make_chumpy_stub()
    with open(model_path, "rb") as f:
        model = pickle.load(f, encoding="latin1")

    shapedirs = model.get("shapedirs")
    shapedirs_array = getattr(shapedirs, "x", shapedirs)
    if shapedirs_array is None:
        return None

    shapedirs_array = np.asarray(shapedirs_array, dtype=np.float64)
    if shapedirs_array.ndim != 3 or shapedirs_array.shape[1] != 3:
        return None

    vertices = np.array(model["v_template"], dtype=np.float64)
    faces = np.array(model["f"], dtype=np.int32)
    _, _, used_vertices = _extract_largest_face_component_with_indices(vertices, faces)
    max_components = min(components, shapedirs_array.shape[2])
    if max_components <= 0:
        return None
    return np.array(
        shapedirs_array[used_vertices, :, :max_components],
        dtype=np.float64,
    )


# ---------------------------------------------------------------------------
# Landmark and diagnostics models
# ---------------------------------------------------------------------------

class LandmarkPoint(NamedTuple):
    label: str
    x: float
    y: float
    z: float
    nx: float
    ny: float
    nz: float


class FlameReconstructionResult(NamedTuple):
    ply_bytes: bytes
    procrustes_scale: float
    diagnostics: dict[str, Any]


class RobustSimilarityResult(NamedTuple):
    scale: float
    rotation: np.ndarray
    translation: np.ndarray
    residuals: np.ndarray
    inlier_indices: np.ndarray
    threshold_mm: float


class FlamePriorFit(NamedTuple):
    vertices: np.ndarray
    landmarks: np.ndarray
    beta: np.ndarray | None
    scale: float
    rotation: np.ndarray
    translation: np.ndarray
    robust_similarity: RobustSimilarityResult
    landmark_weights: np.ndarray
    diagnostics: dict[str, Any]


class ControlPointSet(NamedTuple):
    skull_ctrl: np.ndarray
    face_ctrl: np.ndarray
    depths_by_label: dict[str, float]
    normals_by_label: dict[str, list[float]]
    tolerances_by_label: dict[str, float]
    region_confidence_by_label: dict[str, float]


class GeometryValidationError(ValueError):
    """Raised when the warped FLAME mesh is numerically valid but implausible."""

    def __init__(self, summary: str, diagnostics: dict[str, Any]):
        super().__init__(summary)
        self.summary = summary
        self.diagnostics = diagnostics


# ---------------------------------------------------------------------------
# Core reconstruction helpers
# ---------------------------------------------------------------------------

def _load_skull(skull_mesh_bytes: bytes, mesh_format: str) -> trimesh.Trimesh:
    skull = trimesh.load(
        trimesh.util.wrap_as_stream(skull_mesh_bytes),
        file_type=mesh_format,
        process=False,
    )
    if isinstance(skull, trimesh.Scene):
        skull = skull.dump(concatenate=True)
    if not isinstance(skull, trimesh.Trimesh):
        raise ValueError(f"Unsupported skull mesh type: {type(skull)!r}")
    if len(skull.vertices) == 0 or len(skull.faces) == 0:
        raise ValueError("Skull mesh is empty")
    return skull


def _validate_landmarks(landmarks: list[LandmarkPoint]) -> list[LandmarkPoint]:
    expected = set(LANDMARK_ORDER)
    counts = Counter(lm.label for lm in landmarks)

    duplicates = sorted(label for label, count in counts.items() if count > 1)
    missing = sorted(label for label in LANDMARK_ORDER if label not in counts)
    extras = sorted(label for label in counts if label not in expected)

    if duplicates or missing or extras or len(landmarks) != len(LANDMARK_ORDER):
        problems: list[str] = []
        if missing:
            problems.append(f"missing={missing}")
        if duplicates:
            problems.append(f"duplicates={duplicates}")
        if extras:
            problems.append(f"unknown={extras}")
        if len(landmarks) != len(LANDMARK_ORDER):
            problems.append(
                f"count={len(landmarks)} expected={len(LANDMARK_ORDER)}"
            )
        raise ValueError(
            "Invalid landmark set for reconstruction: " + ", ".join(problems)
        )

    by_label = {lm.label: lm for lm in landmarks}
    return [by_label[label] for label in LANDMARK_ORDER]


def _control_point_set(
    skull: trimesh.Trimesh,
    landmarks: list[LandmarkPoint],
    sex: str,
    ancestry: str,
    age_range: str,
    fstt_k_factor: float,
) -> ControlPointSet:
    """
    Build control points in a stable label order.

    FSTT depths are point estimates from the table; the returned tolerances are
    solver uncertainty bands used to avoid overfitting noisy/manual landmarks.
    """
    from app.core.fstt import get_fstt

    ordered_landmarks = _validate_landmarks(landmarks)
    skull_vertices = np.asarray(skull.vertices, dtype=np.float64)
    skull_normals = np.asarray(skull.vertex_normals, dtype=np.float64)
    if len(skull_vertices) != len(skull_normals):
        raise ValueError("Skull mesh vertex normals could not be computed")

    tree = cKDTree(skull_vertices)

    skull_ctrl: list[np.ndarray] = []
    face_ctrl: list[np.ndarray] = []
    depths_by_label: dict[str, float] = {}
    normals_by_label: dict[str, list[float]] = {}
    tolerances_by_label: dict[str, float] = {}
    region_confidence_by_label: dict[str, float] = {}

    for landmark in ordered_landmarks:
        position = np.array([landmark.x, landmark.y, landmark.z], dtype=np.float64)
        _, nearest_index = tree.query(position)

        normal = np.array(skull_normals[int(nearest_index)], dtype=np.float64)
        normal_length = np.linalg.norm(normal)
        if normal_length <= 1e-8:
            raise ValueError(
                f"Degenerate skull normal for landmark {landmark.label!r}"
            )
        normal = normal / normal_length

        depth_mm = get_fstt(sex, ancestry, age_range, landmark.label)
        depth_mm = max(depth_mm + fstt_k_factor * 2.0, 1.0)

        skull_ctrl.append(position)
        face_ctrl.append(position + normal * depth_mm)
        depths_by_label[landmark.label] = float(depth_mm)
        normals_by_label[landmark.label] = [
            float(normal[0]),
            float(normal[1]),
            float(normal[2]),
        ]
        tolerances_by_label[landmark.label] = float(
            FSTT_CONSTRAINT_TOLERANCE_MM[landmark.label]
        )
        region_confidence_by_label[landmark.label] = float(
            LANDMARK_REGION_CONFIDENCE[landmark.label]
        )

    return ControlPointSet(
        skull_ctrl=np.array(skull_ctrl, dtype=np.float64),
        face_ctrl=np.array(face_ctrl, dtype=np.float64),
        depths_by_label=depths_by_label,
        normals_by_label=normals_by_label,
        tolerances_by_label=tolerances_by_label,
        region_confidence_by_label=region_confidence_by_label,
    )


def _control_points(
    skull: trimesh.Trimesh,
    landmarks: list[LandmarkPoint],
    sex: str,
    ancestry: str,
    age_range: str,
    fstt_k_factor: float,
) -> tuple[np.ndarray, np.ndarray]:
    points = _control_point_set(
        skull,
        landmarks,
        sex,
        ancestry,
        age_range,
        fstt_k_factor,
    )
    return points.skull_ctrl, points.face_ctrl


def estimate_similarity_transform(
    source: np.ndarray,
    target: np.ndarray,
) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Estimate the optimal similarity transform mapping source → target.

    The returned transform is applied to row-major point arrays as:
      transformed = scale * (points @ rotation.T) + translation
    """
    if source.shape != target.shape:
        raise ValueError(
            f"Source/target shape mismatch: {source.shape} != {target.shape}"
        )
    if source.ndim != 2 or source.shape[1] != 3:
        raise ValueError(
            f"Similarity transform expects Nx3 inputs, got {source.shape}"
        )
    if len(source) < 3:
        raise ValueError("Need at least 3 points for similarity transform")

    src = np.asarray(source, dtype=np.float64)
    dst = np.asarray(target, dtype=np.float64)

    src_mean = src.mean(axis=0)
    dst_mean = dst.mean(axis=0)
    src_centered = src - src_mean
    dst_centered = dst - dst_mean

    covariance = src_centered.T @ dst_centered
    u, singular_values, vt = np.linalg.svd(covariance)
    rotation = vt.T @ u.T
    if np.linalg.det(rotation) < 0:
        vt[-1, :] *= -1
        rotation = vt.T @ u.T

    source_variance = np.sum(src_centered**2)
    if source_variance <= 1e-12:
        raise ValueError("Source landmarks are degenerate for similarity transform")

    scale = float(singular_values.sum() / source_variance)
    translation = dst_mean - scale * (src_mean @ rotation.T)
    return scale, rotation, translation


def _apply_similarity_transform(
    points: np.ndarray,
    scale: float,
    rotation: np.ndarray,
    translation: np.ndarray,
) -> np.ndarray:
    return scale * (np.asarray(points, dtype=np.float64) @ rotation.T) + translation


def estimate_robust_similarity_transform(
    source: np.ndarray,
    target: np.ndarray,
    *,
    min_inliers: int = ROBUST_RIGID_MIN_INLIERS,
    iterations: int = 3,
) -> RobustSimilarityResult:
    """
    Similarity transform with deterministic residual-based outlier rejection.

    This keeps a few misplaced/correspondence-bad landmarks from rotating or
    scaling the whole FLAME prior into an implausible pose.
    """
    source = np.asarray(source, dtype=np.float64)
    target = np.asarray(target, dtype=np.float64)
    if len(source) != len(target):
        raise ValueError("Robust similarity source/target length mismatch")
    if len(source) < 3:
        raise ValueError("Need at least 3 points for robust similarity")

    min_inliers = min(max(3, min_inliers), len(source))
    inlier_indices = np.arange(len(source), dtype=np.int32)
    residuals = np.zeros(len(source), dtype=np.float64)
    threshold = float("inf")

    for _ in range(iterations):
        scale, rotation, translation = estimate_similarity_transform(
            source[inlier_indices],
            target[inlier_indices],
        )
        transformed = _apply_similarity_transform(source, scale, rotation, translation)
        residuals = np.linalg.norm(transformed - target, axis=1)

        median = float(np.median(residuals))
        mad = float(np.median(np.abs(residuals - median)))
        robust_sigma = max(1.4826 * mad, 1e-6)
        threshold = max(ROBUST_LANDMARK_SCALE_MM, median + 2.5 * robust_sigma)
        keep = np.flatnonzero(residuals <= threshold).astype(np.int32)
        if len(keep) < min_inliers:
            keep = np.argsort(residuals)[:min_inliers].astype(np.int32)
        if np.array_equal(np.sort(keep), np.sort(inlier_indices)):
            inlier_indices = np.sort(keep)
            break
        inlier_indices = np.sort(keep)

    scale, rotation, translation = estimate_similarity_transform(
        source[inlier_indices],
        target[inlier_indices],
    )
    transformed = _apply_similarity_transform(source, scale, rotation, translation)
    residuals = np.linalg.norm(transformed - target, axis=1)
    return RobustSimilarityResult(
        scale=scale,
        rotation=rotation,
        translation=translation,
        residuals=residuals,
        inlier_indices=inlier_indices,
        threshold_mm=float(threshold),
    )


def _robust_landmark_weights(
    residuals: np.ndarray,
    *,
    scale_mm: float = ROBUST_LANDMARK_SCALE_MM,
    min_weight: float = ROBUST_LANDMARK_MIN_WEIGHT,
) -> np.ndarray:
    residuals = np.asarray(residuals, dtype=np.float64)
    weights = np.ones_like(residuals)
    mask = residuals > scale_mm
    weights[mask] = scale_mm / np.maximum(residuals[mask], 1e-8)
    return np.clip(weights, min_weight, 1.0)


def _fstt_soft_constraint_weights(residuals: np.ndarray) -> np.ndarray:
    """
    Convert FSTT/landmark residuals into soft observation weights.

    This is an algorithmic confidence model: the FSTT mean remains the target,
    but the solver treats large deviations as uncertainty instead of forcing a
    non-human deformation.
    """
    residuals = np.asarray(residuals, dtype=np.float64)
    tolerances = np.asarray(
        [FSTT_CONSTRAINT_TOLERANCE_MM[label] for label in LANDMARK_ORDER],
        dtype=np.float64,
    )
    region_confidence = np.asarray(
        [LANDMARK_REGION_CONFIDENCE[label] for label in LANDMARK_ORDER],
        dtype=np.float64,
    )
    tolerance_weight = tolerances / np.maximum(residuals, tolerances)
    return np.clip(region_confidence * tolerance_weight, ROBUST_LANDMARK_MIN_WEIGHT, 1.0)


def _shape_vertices(
    vertices: np.ndarray,
    shape_basis: np.ndarray,
    beta: np.ndarray,
) -> np.ndarray:
    return np.asarray(vertices, dtype=np.float64) + np.tensordot(
        np.asarray(shape_basis, dtype=np.float64),
        np.asarray(beta, dtype=np.float64),
        axes=([2], [0]),
    )


def _bbox_span(points: np.ndarray) -> np.ndarray:
    return np.ptp(np.asarray(points, dtype=np.float64), axis=0)


def _safe_ratio(numerator: np.ndarray, denominator: np.ndarray) -> np.ndarray:
    denominator = np.asarray(denominator, dtype=np.float64)
    return np.asarray(numerator, dtype=np.float64) / np.where(
        denominator > 1e-8,
        denominator,
        1.0,
    )


def _ordered_flame_landmarks(vertices: np.ndarray) -> np.ndarray:
    mapping = validate_flame_landmark_mapping(FLAME_LANDMARK_VERTICES)
    return np.array(
        [vertices[mapping[label]] for label in LANDMARK_ORDER],
        dtype=np.float64,
    )


def _fit_flame_human_prior(
    flame_vertices: np.ndarray,
    flame_landmarks: np.ndarray,
    face_ctrl: np.ndarray,
    rigid_indices: list[int],
    shape_basis: np.ndarray | None,
) -> FlamePriorFit:
    """
    Fit FLAME within its shape space before any free-form residual warp.

    The fit is intentionally conservative: it uses a robust rigid subset for
    pose/scale, a robust loss for landmark/FSTT targets, and a strong beta prior.
    """
    rigid_source = flame_landmarks[rigid_indices]
    rigid_target = face_ctrl[rigid_indices]
    initial_similarity = estimate_robust_similarity_transform(
        rigid_source,
        rigid_target,
    )
    initial_aligned_landmarks = _apply_similarity_transform(
        flame_landmarks,
        initial_similarity.scale,
        initial_similarity.rotation,
        initial_similarity.translation,
    )
    initial_full_residuals = np.linalg.norm(
        initial_aligned_landmarks - face_ctrl,
        axis=1,
    )
    landmark_weights = np.minimum(
        _robust_landmark_weights(initial_full_residuals),
        _fstt_soft_constraint_weights(initial_full_residuals),
    )

    mapping = validate_flame_landmark_mapping(FLAME_LANDMARK_VERTICES)
    ordered_vertex_indices = np.asarray(
        [mapping[label] for label in LANDMARK_ORDER],
        dtype=np.int32,
    )
    rigid_inliers = initial_similarity.inlier_indices

    beta: np.ndarray | None = None
    fitted_vertices = flame_vertices
    fitted_landmarks = flame_landmarks
    final_similarity = initial_similarity
    optimizer_diagnostics: dict[str, Any] = {
        "shape_prior_enabled": False,
        "shape_prior_components_used": 0,
    }

    if shape_basis is not None and len(shape_basis) == len(flame_vertices):
        components = min(FLAME_SHAPE_COMPONENTS, shape_basis.shape[2])
        if components > 0:
            basis = np.asarray(shape_basis[:, :, :components], dtype=np.float64)
            landmark_basis = basis[ordered_vertex_indices]
            beta0 = np.zeros(components, dtype=np.float64)
            sqrt_weights = np.sqrt(landmark_weights)

            def landmarks_for_beta(candidate_beta: np.ndarray) -> np.ndarray:
                return flame_landmarks + np.tensordot(
                    landmark_basis,
                    candidate_beta,
                    axes=([2], [0]),
                )

            def transform_for_beta(
                candidate_beta: np.ndarray,
            ) -> tuple[np.ndarray, RobustSimilarityResult]:
                candidate_landmarks = landmarks_for_beta(candidate_beta)
                scale, rotation, translation = estimate_similarity_transform(
                    candidate_landmarks[rigid_indices][rigid_inliers],
                    face_ctrl[rigid_indices][rigid_inliers],
                )
                aligned = _apply_similarity_transform(
                    candidate_landmarks,
                    scale,
                    rotation,
                    translation,
                )
                residuals = np.linalg.norm(
                    _apply_similarity_transform(
                        candidate_landmarks[rigid_indices],
                        scale,
                        rotation,
                        translation,
                    )
                    - face_ctrl[rigid_indices],
                    axis=1,
                )
                return aligned, RobustSimilarityResult(
                    scale=scale,
                    rotation=rotation,
                    translation=translation,
                    residuals=residuals,
                    inlier_indices=rigid_inliers,
                    threshold_mm=initial_similarity.threshold_mm,
                )

            def objective(candidate_beta: np.ndarray) -> np.ndarray:
                aligned_landmarks, _ = transform_for_beta(candidate_beta)
                landmark_residuals = (
                    (aligned_landmarks - face_ctrl) * sqrt_weights[:, None]
                ).reshape(-1)
                prior_residuals = candidate_beta * FLAME_SHAPE_PRIOR_WEIGHT_MM
                return np.concatenate([landmark_residuals, prior_residuals])

            try:
                result = least_squares(
                    objective,
                    beta0,
                    bounds=(-FLAME_SHAPE_BETA_BOUND, FLAME_SHAPE_BETA_BOUND),
                    loss="soft_l1",
                    f_scale=FLAME_SHAPE_LOSS_SCALE_MM,
                    max_nfev=80,
                )
                beta = np.asarray(result.x, dtype=np.float64)
                fitted_vertices = _shape_vertices(flame_vertices, basis, beta)
                fitted_landmarks = _ordered_flame_landmarks(fitted_vertices)
                _, final_similarity = transform_for_beta(beta)
                optimizer_diagnostics = {
                    "shape_prior_enabled": True,
                    "shape_prior_components_used": int(components),
                    "shape_prior_cost": float(result.cost),
                    "shape_prior_optimality": float(result.optimality),
                    "shape_prior_nfev": int(result.nfev),
                    "shape_prior_beta_l2": float(np.linalg.norm(beta)),
                    "shape_prior_beta_max_abs": float(np.max(np.abs(beta))),
                }
            except Exception as exc:
                log.warning("FLAME shape prior fit failed; using neutral prior: %s", exc)
                optimizer_diagnostics = {
                    "shape_prior_enabled": False,
                    "shape_prior_components_used": 0,
                    "shape_prior_error": str(exc),
                }

    final_aligned_landmarks = _apply_similarity_transform(
        fitted_landmarks,
        final_similarity.scale,
        final_similarity.rotation,
        final_similarity.translation,
    )
    final_full_residuals = np.linalg.norm(final_aligned_landmarks - face_ctrl, axis=1)
    final_weights = np.minimum(
        _robust_landmark_weights(final_full_residuals),
        _fstt_soft_constraint_weights(final_full_residuals),
    )
    inlier_labels = [
        RIGID_PROCRUSTES_LABELS[int(index)]
        for index in final_similarity.inlier_indices.tolist()
    ]
    outlier_labels = [
        label for label in RIGID_PROCRUSTES_LABELS if label not in set(inlier_labels)
    ]

    diagnostics = {
        **optimizer_diagnostics,
        "robust_similarity_threshold_mm": final_similarity.threshold_mm,
        "robust_similarity_inlier_labels": inlier_labels,
        "robust_similarity_outlier_labels": outlier_labels,
        "robust_landmark_weights_by_label": {
            label: float(final_weights[index])
            for index, label in enumerate(LANDMARK_ORDER)
        },
    }
    return FlamePriorFit(
        vertices=fitted_vertices,
        landmarks=fitted_landmarks,
        beta=beta,
        scale=final_similarity.scale,
        rotation=final_similarity.rotation,
        translation=final_similarity.translation,
        robust_similarity=final_similarity,
        landmark_weights=final_weights,
        diagnostics=diagnostics,
    )


def _greedy_farthest_point_sampling(
    points: np.ndarray,
    count: int,
    initial_scores: np.ndarray | None = None,
) -> np.ndarray:
    points = np.asarray(points, dtype=np.float64)
    if len(points) == 0 or count <= 0:
        return np.empty((0, 3), dtype=np.float64)
    if len(points) <= count:
        return points.copy()

    if initial_scores is None:
        centroid = points.mean(axis=0)
        initial_scores = np.linalg.norm(points - centroid, axis=1)
    else:
        initial_scores = np.asarray(initial_scores, dtype=np.float64)

    first_index = int(np.argmax(initial_scores))
    selected_indices = [first_index]
    min_distances = np.linalg.norm(points - points[first_index], axis=1)

    while len(selected_indices) < count:
        next_index = int(np.argmax(min_distances))
        selected_indices.append(next_index)
        candidate_distances = np.linalg.norm(points - points[next_index], axis=1)
        min_distances = np.minimum(min_distances, candidate_distances)

    return points[np.asarray(selected_indices, dtype=np.int32)]


def select_stabilization_anchors(
    aligned_vertices: np.ndarray,
    aligned_landmarks: np.ndarray,
    *,
    count: int = STABILIZATION_ANCHOR_COUNT,
    top_distance_quantile: float = STABILIZATION_TOP_DISTANCE_QUANTILE,
) -> np.ndarray:
    """
    Pick deterministic posterior anchors to keep unconstrained regions stable.
    """
    aligned_vertices = np.asarray(aligned_vertices, dtype=np.float64)
    aligned_landmarks = np.asarray(aligned_landmarks, dtype=np.float64)
    if len(aligned_vertices) == 0:
        return np.empty((0, 3), dtype=np.float64)

    landmark_tree = cKDTree(aligned_landmarks)
    distances, _ = landmark_tree.query(aligned_vertices)
    threshold = float(np.quantile(distances, top_distance_quantile))
    candidate_mask = distances >= threshold
    candidate_vertices = aligned_vertices[candidate_mask]
    candidate_scores = distances[candidate_mask]

    if len(candidate_vertices) == 0:
        candidate_vertices = aligned_vertices
        candidate_scores = distances

    return _greedy_farthest_point_sampling(
        candidate_vertices,
        count,
        initial_scores=candidate_scores,
    )


def _limit_residual_displacements(
    vertices: np.ndarray,
    aligned_landmarks: np.ndarray,
    displacements: np.ndarray,
) -> tuple[np.ndarray, dict[str, Any]]:
    """
    Keep residual TPS as a local correction around landmarks, not a new face.
    """
    vertices = np.asarray(vertices, dtype=np.float64)
    aligned_landmarks = np.asarray(aligned_landmarks, dtype=np.float64)
    displacements = np.asarray(displacements, dtype=np.float64)

    span = _bbox_span(vertices)
    max_span = float(np.max(span))
    cap = min(
        RESIDUAL_DISPLACEMENT_MAX_MM,
        max(1.0, RESIDUAL_DISPLACEMENT_MAX_SPAN_RATIO * max_span),
    )
    landmark_tree = cKDTree(aligned_landmarks)
    distances, _ = landmark_tree.query(vertices)
    radius = max(1.0, RESIDUAL_DISPLACEMENT_FALLOFF_RATIO * max_span)
    falloff = RESIDUAL_DISPLACEMENT_FALLOFF_FLOOR + (
        1.0 - RESIDUAL_DISPLACEMENT_FALLOFF_FLOOR
    ) * np.exp(-((distances / radius) ** 2))

    localized = displacements * falloff[:, None]
    magnitudes = np.linalg.norm(localized, axis=1)
    scale = np.minimum(1.0, cap / np.maximum(magnitudes, 1e-8))
    limited = localized * scale[:, None]
    limited_magnitudes = np.linalg.norm(limited, axis=1)

    return limited, {
        "residual_displacement_cap_mm": float(cap),
        "residual_displacement_falloff_radius_mm": float(radius),
        "residual_displacement_falloff_floor": RESIDUAL_DISPLACEMENT_FALLOFF_FLOOR,
        "raw_residual_displacement_p95_mm": float(
            np.percentile(np.linalg.norm(displacements, axis=1), 95)
        ),
        "limited_residual_displacement_p95_mm": float(
            np.percentile(limited_magnitudes, 95)
        ),
        "limited_residual_displacement_max_mm": float(limited_magnitudes.max()),
    }


def _smooth_reconstructed_surface(
    vertices: np.ndarray,
    faces: np.ndarray,
    *,
    iterations: int = SURFACE_SMOOTHING_ITERATIONS,
) -> tuple[np.ndarray, dict[str, Any]]:
    if iterations <= 0:
        return vertices, {"surface_smoothing_enabled": False, "iterations": 0}

    mesh = trimesh.Trimesh(vertices=vertices.copy(), faces=faces, process=False)
    before = np.asarray(mesh.vertices, dtype=np.float64).copy()
    try:
        trimesh.smoothing.filter_taubin(
            mesh,
            lamb=0.45,
            nu=-0.47,
            iterations=iterations,
        )
        after = np.asarray(mesh.vertices, dtype=np.float64)
        if not np.isfinite(after).all():
            raise ValueError("surface smoothing produced non-finite vertices")
        deltas = np.linalg.norm(after - before, axis=1)
        return after, {
            "surface_smoothing_enabled": True,
            "surface_smoothing_method": "taubin",
            "surface_smoothing_iterations": int(iterations),
            "surface_smoothing_delta_mean_mm": float(deltas.mean()),
            "surface_smoothing_delta_p95_mm": float(np.percentile(deltas, 95)),
            "surface_smoothing_delta_max_mm": float(deltas.max()),
        }
    except Exception as exc:
        log.warning("Surface smoothing failed; exporting unsmoothed mesh: %s", exc)
        return vertices, {
            "surface_smoothing_enabled": False,
            "surface_smoothing_iterations": 0,
            "surface_smoothing_error": str(exc),
        }


def validate_reconstruction_geometry(
    diagnostics: dict[str, Any],
    deformed_vertices: np.ndarray,
    faces: np.ndarray,
) -> None:
    problems = _geometry_validation_problems(diagnostics, deformed_vertices)

    if problems:
        summary = _format_geometry_rejection(problems, diagnostics)
        raise GeometryValidationError(summary, diagnostics)


def _geometry_validation_problems(
    diagnostics: dict[str, Any],
    deformed_vertices: np.ndarray,
) -> list[str]:
    problems: list[str] = []
    component_count = int(diagnostics["component_count"])
    finite = bool(np.isfinite(deformed_vertices).all())

    if not finite:
        problems.append("non-finite vertices detected")
    if component_count > 1:
        problems.append(f"component_count={component_count}")

    return problems


def _format_geometry_rejection(
    problems: list[str],
    diagnostics: dict[str, Any],
) -> str:
    top_rigid = diagnostics.get("top_rigid_residuals", [])
    top_rigid_text = ""
    if top_rigid:
        formatted = ", ".join(
            f"{item['label']}={item['residual_mm']:.2f}mm"
            for item in top_rigid[:3]
        )
        top_rigid_text = f" Worst landmarks: {formatted}."
    return (
        "Rejected FLAME reconstruction: "
        + "; ".join(problems)
        + ". Likely FLAME landmark mapping or warp instability."
        + top_rigid_text
    )


def _confidence_concerns(diagnostics: dict[str, Any]) -> list[str]:
    concerns: list[str] = []
    rigid_mean = float(diagnostics.get("robust_rigid_residual_mean_mm", 0.0))
    rigid_max = float(diagnostics.get("robust_rigid_residual_max_mm", 0.0))
    inlier_count = int(
        diagnostics.get("robust_rigid_inlier_count", len(RIGID_PROCRUSTES_LABELS))
    )
    bbox_ratio = np.asarray(
        diagnostics.get("deformed_to_face_bbox_ratio", [1.0, 1.0, 1.0]),
        dtype=np.float64,
    )
    landmark_error_mean = float(
        diagnostics.get("landmark_error_after_tps_mean_mm", 0.0)
    )
    landmark_error_max = float(diagnostics.get("landmark_error_after_tps_max_mm", 0.0))
    displacement_p95 = float(diagnostics.get("displacement_p95_mm", 0.0))
    aligned_span = np.asarray(
        diagnostics.get("aligned_flame_bbox_span", [1.0, 1.0, 1.0]),
        dtype=np.float64,
    )
    aligned_extent = float(np.max(aligned_span))

    if rigid_mean > MAX_RIGID_RESIDUAL_MEAN_MM:
        concerns.append(
            f"residual rígido medio alto ({rigid_mean:.2f}mm)"
        )
    if rigid_max > MAX_RIGID_RESIDUAL_MAX_MM:
        concerns.append(f"residual rígido máximo alto ({rigid_max:.2f}mm)")
    if inlier_count < ROBUST_RIGID_MIN_INLIERS:
        concerns.append(f"pocos landmarks rígidos confiables ({inlier_count})")

    for axis_name, ratio in zip(("x", "y", "z"), bbox_ratio.tolist(), strict=True):
        if ratio < MIN_BBOX_RATIO:
            concerns.append(f"bbox FSTT {axis_name} bajo ({ratio:.2f})")
        elif ratio > MAX_BBOX_RATIO:
            concerns.append(f"bbox FSTT {axis_name} alto ({ratio:.2f})")

    if landmark_error_mean > 8.0:
        concerns.append(
            f"error medio landmark/FSTT alto ({landmark_error_mean:.2f}mm)"
        )
    if landmark_error_max > 16.0:
        concerns.append(
            f"error máximo landmark/FSTT alto ({landmark_error_max:.2f}mm)"
        )
    if aligned_extent > 1e-8 and displacement_p95 / aligned_extent > 0.22:
        concerns.append("deformación residual local limitada")

    low_weight_labels = [
        label
        for label, weight in (
            diagnostics.get("residual_landmark_weights_by_label") or {}
        ).items()
        if float(weight) <= 0.22
    ]
    if low_weight_labels:
        concerns.append(
            "landmarks de baja confianza: " + ", ".join(low_weight_labels[:5])
        )

    return concerns


def _confidence_score(
    diagnostics: dict[str, Any],
    hard_problems: list[str],
    human_shape_problems: list[str],
) -> float:
    score = 1.0
    rigid_mean = float(diagnostics.get("robust_rigid_residual_mean_mm", 0.0))
    rigid_max = float(diagnostics.get("robust_rigid_residual_max_mm", 0.0))
    landmark_error_mean = float(
        diagnostics.get("landmark_error_after_tps_mean_mm", 0.0)
    )
    landmark_error_max = float(diagnostics.get("landmark_error_after_tps_max_mm", 0.0))
    alpha = float(diagnostics.get("blend_alpha", 1.0))
    weights = np.asarray(
        list((diagnostics.get("residual_landmark_weights_by_label") or {}).values()),
        dtype=np.float64,
    )

    if hard_problems:
        score -= 0.45
    if human_shape_problems:
        score -= 0.25
    score -= min(0.18, max(0.0, rigid_mean - 3.0) / 30.0)
    score -= min(0.18, max(0.0, rigid_max - 7.0) / 45.0)
    score -= min(0.18, max(0.0, landmark_error_mean - 4.0) / 40.0)
    score -= min(0.12, max(0.0, landmark_error_max - 12.0) / 80.0)
    score -= (1.0 - alpha) * 0.22
    if weights.size:
        score -= min(0.15, max(0.0, 0.55 - float(weights.mean())) * 0.25)

    return float(np.clip(score, 0.05, 1.0))


def _quality_status_from_confidence(score: float, alpha: float) -> str:
    if alpha <= 0.0:
        return "fallback"
    if score >= 0.72 and alpha >= 0.65:
        return "ok"
    return "degraded"


def _format_quality_warning(
    diagnostics: dict[str, Any],
    concerns: list[str],
) -> str | None:
    quality_status = diagnostics.get("quality_status")
    if quality_status == "ok" and not concerns:
        return None
    confidence = float(diagnostics.get("confidence_score", 0.0))
    top_rigid = diagnostics.get("top_rigid_residuals", [])
    worst = ""
    if top_rigid:
        formatted = ", ".join(
            f"{item['label']}={item['residual_mm']:.2f}mm"
            for item in top_rigid[:3]
        )
        worst = f" Landmarks más inciertos: {formatted}."
    reason = "; ".join(concerns[:4]) if concerns else "deformación conservadora"
    return (
        f"Aproximación de confianza {confidence:.2f}: {reason}. "
        "Se priorizó mantener una forma humana FLAME y usar FSTT como guía "
        "estadística, no como ajuste rígido punto-a-punto."
        + worst
    )


def _human_shape_problems(
    vertices: np.ndarray,
    faces: np.ndarray,
    aligned_span: np.ndarray,
    displacement_magnitudes: np.ndarray,
) -> list[str]:
    problems: list[str] = []
    if not np.isfinite(vertices).all():
        problems.append("non-finite vertices detected")

    component_count = _count_face_components(faces)
    if component_count > 1:
        problems.append(f"component_count={component_count}")

    span = _bbox_span(vertices)
    aligned_ratio = _safe_ratio(span, aligned_span)
    for axis_name, ratio in zip(("x", "y", "z"), aligned_ratio.tolist(), strict=True):
        if ratio < MIN_HUMAN_BBOX_RATIO_TO_ALIGNED:
            problems.append(
                f"human bbox {axis_name} ratio {ratio:.2f} < "
                f"{MIN_HUMAN_BBOX_RATIO_TO_ALIGNED:.2f}"
            )
        elif ratio > MAX_HUMAN_BBOX_RATIO_TO_ALIGNED:
            problems.append(
                f"human bbox {axis_name} ratio {ratio:.2f} > "
                f"{MAX_HUMAN_BBOX_RATIO_TO_ALIGNED:.2f}"
            )

    aligned_extent = float(np.max(aligned_span))
    displacement_p95 = float(np.percentile(displacement_magnitudes, 95))
    if aligned_extent > 1e-8:
        displacement_ratio = displacement_p95 / aligned_extent
        if displacement_ratio > MAX_HUMAN_DISPLACEMENT_P95_RATIO:
            problems.append(
                f"p95 displacement ratio {displacement_ratio:.2f} > "
                f"{MAX_HUMAN_DISPLACEMENT_P95_RATIO:.2f}"
            )

    return problems


def _candidate_diagnostics(
    base: dict[str, Any],
    *,
    alpha: float,
    vertices: np.ndarray,
    faces: np.ndarray,
    aligned_span: np.ndarray,
    face_ctrl_span: np.ndarray,
    displacement_magnitudes: np.ndarray,
    deformed_landmarks: np.ndarray,
    face_ctrl: np.ndarray,
    landmark_errors: np.ndarray,
) -> dict[str, Any]:
    deformed_span = _bbox_span(vertices)
    diagnostics = {
        **base,
        "candidate_name": (
            "procrustes_only" if alpha == 0 else f"anchored_tps_alpha_{alpha:.2f}"
        ),
        "blend_alpha": float(alpha),
        "deformed_flame_bbox_span": deformed_span.tolist(),
        "deformed_to_face_bbox_ratio": _safe_ratio(
            deformed_span,
            face_ctrl_span,
        ).tolist(),
        "deformed_to_aligned_bbox_ratio": _safe_ratio(
            deformed_span,
            aligned_span,
        ).tolist(),
        "displacement_mean_mm": float(displacement_magnitudes.mean()),
        "displacement_p95_mm": float(np.percentile(displacement_magnitudes, 95)),
        "displacement_max_mm": float(displacement_magnitudes.max()),
        "landmark_error_after_tps_mean_mm": float(landmark_errors.mean()),
        "landmark_error_after_tps_max_mm": float(landmark_errors.max()),
        "deformed_landmarks_by_label": {
            label: [
                float(deformed_landmarks[index][0]),
                float(deformed_landmarks[index][1]),
                float(deformed_landmarks[index][2]),
            ]
            for index, label in enumerate(LANDMARK_ORDER)
        },
        "face_control_points_by_label": {
            label: [
                float(face_ctrl[index][0]),
                float(face_ctrl[index][1]),
                float(face_ctrl[index][2]),
            ]
            for index, label in enumerate(LANDMARK_ORDER)
        },
        "component_count": int(_count_face_components(faces)),
    }
    geometry_problems = _geometry_validation_problems(diagnostics, vertices)
    human_shape_problems = _human_shape_problems(
        vertices,
        faces,
        aligned_span,
        displacement_magnitudes,
    )
    diagnostics["geometry_validation"] = {
        "passed": not geometry_problems,
        "problems": geometry_problems,
    }
    diagnostics["human_shape_validation"] = {
        "passed": not human_shape_problems,
        "problems": human_shape_problems,
    }
    confidence_concerns = _confidence_concerns(diagnostics)
    confidence_score = _confidence_score(
        diagnostics,
        geometry_problems,
        human_shape_problems,
    )
    diagnostics["confidence_score"] = confidence_score
    diagnostics["confidence_reasons"] = confidence_concerns
    return diagnostics


def _select_exportable_candidate(
    *,
    flame_aligned: np.ndarray,
    flame_aligned_landmarks: np.ndarray,
    face_ctrl: np.ndarray,
    flame_faces: np.ndarray,
    full_displacements: np.ndarray,
    landmark_displacements: np.ndarray,
    base_diagnostics: dict[str, Any],
) -> tuple[np.ndarray, dict[str, Any]]:
    aligned_span = _bbox_span(flame_aligned)
    face_ctrl_span = _bbox_span(face_ctrl)
    selected_vertices: np.ndarray | None = None
    selected_diagnostics: dict[str, Any] | None = None
    full_geometry_problems: list[str] = []
    full_human_shape_problems: list[str] = []
    candidate_summaries: list[dict[str, Any]] = []

    for alpha in TPS_BLEND_FACTORS:
        vertices = flame_aligned + full_displacements * alpha
        deformed_landmarks = flame_aligned_landmarks + landmark_displacements * alpha
        displacement_magnitudes = np.linalg.norm(full_displacements * alpha, axis=1)
        landmark_errors = np.linalg.norm(deformed_landmarks - face_ctrl, axis=1)
        diagnostics = _candidate_diagnostics(
            base_diagnostics,
            alpha=alpha,
            vertices=vertices,
            faces=flame_faces,
            aligned_span=aligned_span,
            face_ctrl_span=face_ctrl_span,
            displacement_magnitudes=displacement_magnitudes,
            deformed_landmarks=deformed_landmarks,
            face_ctrl=face_ctrl,
            landmark_errors=landmark_errors,
        )
        geometry_problems = diagnostics["geometry_validation"]["problems"]
        human_shape_problems = diagnostics["human_shape_validation"]["problems"]
        if alpha == 1.0:
            full_geometry_problems = list(geometry_problems)
            full_human_shape_problems = list(human_shape_problems)

        candidate_summaries.append(
            {
                "candidate_name": diagnostics["candidate_name"],
                "blend_alpha": diagnostics["blend_alpha"],
                "geometry_passed": diagnostics["geometry_validation"]["passed"],
                "human_shape_passed": diagnostics["human_shape_validation"]["passed"],
                "deformed_to_face_bbox_ratio": diagnostics[
                    "deformed_to_face_bbox_ratio"
                ],
                "deformed_to_aligned_bbox_ratio": diagnostics[
                    "deformed_to_aligned_bbox_ratio"
                ],
                "displacement_p95_mm": diagnostics["displacement_p95_mm"],
                "landmark_error_after_tps_mean_mm": diagnostics[
                    "landmark_error_after_tps_mean_mm"
                ],
            }
        )

        if not geometry_problems and not human_shape_problems:
            diagnostics["quality_status"] = _quality_status_from_confidence(
                float(diagnostics["confidence_score"]),
                alpha,
            )
            diagnostics["warning_message"] = _format_quality_warning(
                diagnostics,
                diagnostics["confidence_reasons"],
            )
            selected_vertices = vertices
            selected_diagnostics = diagnostics
            break

        if alpha < 1.0 and not geometry_problems and selected_vertices is None:
            diagnostics["quality_status"] = "fallback" if alpha == 0.0 else "degraded"
            diagnostics["warning_message"] = _format_quality_warning(
                diagnostics,
                diagnostics["confidence_reasons"] + human_shape_problems,
            )
            selected_vertices = vertices
            selected_diagnostics = diagnostics

    if selected_vertices is None or selected_diagnostics is None:
        # Procrustes-only should normally be finite and single-component. If it
        # is not, the FLAME template or input mesh is genuinely unusable.
        alpha = 0.0
        selected_vertices = flame_aligned
        selected_diagnostics = _candidate_diagnostics(
            base_diagnostics,
            alpha=alpha,
            vertices=selected_vertices,
            faces=flame_faces,
            aligned_span=aligned_span,
            face_ctrl_span=face_ctrl_span,
            displacement_magnitudes=np.zeros(len(flame_aligned), dtype=np.float64),
            deformed_landmarks=flame_aligned_landmarks,
            face_ctrl=face_ctrl,
            landmark_errors=np.linalg.norm(flame_aligned_landmarks - face_ctrl, axis=1),
        )
        selected_diagnostics["quality_status"] = "fallback"
        selected_diagnostics["warning_message"] = _format_quality_warning(
            selected_diagnostics,
            selected_diagnostics["confidence_reasons"],
        )

    selected_diagnostics["candidate_summaries"] = candidate_summaries
    selected_diagnostics["full_tps_geometry_problems"] = full_geometry_problems
    selected_diagnostics["full_tps_human_shape_problems"] = full_human_shape_problems
    if selected_diagnostics.get("warning_message") is None:
        selected_diagnostics["warning_message"] = _format_quality_warning(
            selected_diagnostics,
            selected_diagnostics.get("confidence_reasons", []),
        )

    return selected_vertices, selected_diagnostics


# ---------------------------------------------------------------------------
# Public reconstruction API
# ---------------------------------------------------------------------------

def reconstruct_flame_with_metadata(
    skull_mesh_bytes: bytes,
    mesh_format: str,
    landmarks: list[LandmarkPoint],
    sex: str,
    ancestry: str,
    age_range: str,
    fstt_k_factor: float,
    flame_model_path: str,
) -> FlameReconstructionResult:
    skull = _load_skull(skull_mesh_bytes, mesh_format)
    flame_vertices, flame_faces = load_flame_template(flame_model_path)
    try:
        shape_basis = load_flame_shape_basis(flame_model_path)
    except Exception as exc:
        log.warning("Could not load FLAME shape basis; using neutral prior: %s", exc)
        shape_basis = None

    control_points = _control_point_set(
        skull,
        landmarks,
        sex,
        ancestry,
        age_range,
        fstt_k_factor,
    )
    skull_ctrl = control_points.skull_ctrl
    face_ctrl = control_points.face_ctrl

    flame_landmarks = _ordered_flame_landmarks(flame_vertices)
    rigid_indices = [LANDMARK_ORDER.index(label) for label in RIGID_PROCRUSTES_LABELS]

    prior_fit = _fit_flame_human_prior(
        flame_vertices,
        flame_landmarks,
        face_ctrl,
        rigid_indices,
        shape_basis,
    )

    flame_aligned = _apply_similarity_transform(
        prior_fit.vertices,
        prior_fit.scale,
        prior_fit.rotation,
        prior_fit.translation,
    )
    flame_aligned_landmarks = _apply_similarity_transform(
        prior_fit.landmarks,
        prior_fit.scale,
        prior_fit.rotation,
        prior_fit.translation,
    )

    rigid_residuals = np.linalg.norm(
        flame_aligned_landmarks[rigid_indices] - face_ctrl[rigid_indices],
        axis=1,
    )
    robust_rigid_residuals = rigid_residuals[prior_fit.robust_similarity.inlier_indices]
    full_pre_tps_residuals = np.linalg.norm(flame_aligned_landmarks - face_ctrl, axis=1)
    residual_landmark_weights = np.minimum(
        _robust_landmark_weights(full_pre_tps_residuals),
        _fstt_soft_constraint_weights(full_pre_tps_residuals),
    )
    combined_landmark_weights = np.minimum(
        residual_landmark_weights,
        prior_fit.landmark_weights,
    )
    robust_face_ctrl = flame_aligned_landmarks + (
        face_ctrl - flame_aligned_landmarks
    ) * combined_landmark_weights[:, None]

    anchors = select_stabilization_anchors(
        flame_aligned,
        flame_aligned_landmarks,
        count=STABILIZATION_ANCHOR_COUNT,
        top_distance_quantile=STABILIZATION_TOP_DISTANCE_QUANTILE,
    )

    tps_source = np.vstack([flame_aligned_landmarks, anchors])
    tps_target = np.vstack([robust_face_ctrl, anchors])
    tps = RBFInterpolator(
        tps_source,
        tps_target - tps_source,
        kernel="thin_plate_spline",
        degree=1,
        smoothing=TPS_SMOOTHING,
    )

    raw_displacements = tps(flame_aligned)
    displacements, residual_limit_diagnostics = _limit_residual_displacements(
        flame_aligned,
        flame_aligned_landmarks,
        raw_displacements,
    )
    landmark_displacements = tps(flame_aligned_landmarks)

    face_ctrl_span = _bbox_span(face_ctrl)
    aligned_span = _bbox_span(flame_aligned)
    component_count = _count_face_components(flame_faces)

    base_diagnostics: dict[str, Any] = {
        "method": "forensic_v1_soft_fstt_flame_prior",
        "forensic_model_version": "forensic_v1_soft_fstt_flame_prior",
        "normals_source": NORMALS_SOURCE,
        "tps_smoothing": TPS_SMOOTHING,
        "anchor_count": int(len(anchors)),
        "fstt_profile": {
            "sex": sex,
            "ancestry": ancestry,
            "age_range": age_range,
            "fstt_k_factor": float(fstt_k_factor),
            "variant": "mean_fstt",
        },
        "fstt_depths_by_label": control_points.depths_by_label,
        "fstt_constraint_tolerances_by_label": control_points.tolerances_by_label,
        "landmark_region_confidence_by_label": control_points.region_confidence_by_label,
        "skull_normals_by_label": control_points.normals_by_label,
        "skull_control_points_by_label": {
            label: [
                float(skull_ctrl[index][0]),
                float(skull_ctrl[index][1]),
                float(skull_ctrl[index][2]),
            ]
            for index, label in enumerate(LANDMARK_ORDER)
        },
        "rigid_landmark_labels": list(RIGID_PROCRUSTES_LABELS),
        "rigid_residual_mean_mm": float(rigid_residuals.mean()),
        "rigid_residual_max_mm": float(rigid_residuals.max()),
        "robust_rigid_residual_mean_mm": float(robust_rigid_residuals.mean()),
        "robust_rigid_residual_max_mm": float(robust_rigid_residuals.max()),
        "robust_rigid_inlier_count": int(len(robust_rigid_residuals)),
        "rigid_residuals_by_label": {
            label: float(rigid_residuals[index])
            for index, label in enumerate(RIGID_PROCRUSTES_LABELS)
        },
        "top_rigid_residuals": [
            {
                "label": label,
                "residual_mm": float(residual),
            }
            for label, residual in sorted(
                zip(RIGID_PROCRUSTES_LABELS, rigid_residuals.tolist(), strict=True),
                key=lambda item: item[1],
                reverse=True,
            )
        ],
        "full_pre_tps_residual_mean_mm": float(full_pre_tps_residuals.mean()),
        "full_pre_tps_residual_max_mm": float(full_pre_tps_residuals.max()),
        "full_pre_tps_residuals_by_label": {
            label: float(full_pre_tps_residuals[index])
            for index, label in enumerate(LANDMARK_ORDER)
        },
        "residual_landmark_weights_by_label": {
            label: float(combined_landmark_weights[index])
            for index, label in enumerate(LANDMARK_ORDER)
        },
        "face_ctrl_bbox_span": face_ctrl_span.tolist(),
        "aligned_flame_bbox_span": aligned_span.tolist(),
        "component_count": int(component_count),
        "template_vertex_count": int(len(flame_vertices)),
        "template_face_count": int(len(flame_faces)),
        **prior_fit.diagnostics,
        **residual_limit_diagnostics,
    }

    flame_deformed, diagnostics = _select_exportable_candidate(
        flame_aligned=flame_aligned,
        flame_aligned_landmarks=flame_aligned_landmarks,
        face_ctrl=face_ctrl,
        flame_faces=flame_faces,
        full_displacements=displacements,
        landmark_displacements=landmark_displacements,
        base_diagnostics=base_diagnostics,
    )
    flame_deformed, smoothing_diagnostics = _smooth_reconstructed_surface(
        flame_deformed,
        flame_faces,
    )
    diagnostics.update(smoothing_diagnostics)
    diagnostics["deformed_flame_bbox_span_after_smoothing"] = _bbox_span(
        flame_deformed
    ).tolist()
    diagnostics["component_count_after_smoothing"] = int(
        _count_face_components(flame_faces)
    )

    result_mesh = trimesh.Trimesh(
        vertices=flame_deformed,
        faces=flame_faces,
        process=False,
    )
    ply_bytes = result_mesh.export(file_type="ply")
    if isinstance(ply_bytes, str):
        ply_bytes = ply_bytes.encode("utf-8")

    return FlameReconstructionResult(
        ply_bytes=ply_bytes,
        procrustes_scale=prior_fit.scale,
        diagnostics=diagnostics,
    )


def reconstruct_flame(*args: Any, **kwargs: Any) -> bytes:
    return reconstruct_flame_with_metadata(*args, **kwargs).ply_bytes


reconstruct = reconstruct_flame
