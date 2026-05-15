import io
import math

import numpy as np
import pytest
import trimesh

from app.core import reconstruction
from app.core.flame_landmarks import (
    FLAME_LANDMARK_VERTICES,
    LANDMARK_ORDER,
    RIGID_PROCRUSTES_LABELS,
    validate_flame_landmark_mapping,
)
from app.core.fstt import get_fstt
from app.workers._runner import prepare_mesh_for_pipeline


def _make_landmarks_from_vertices(
    vertices: np.ndarray,
    wrong_normal: tuple[float, float, float] = (0.0, 0.0, -1.0),
) -> list[reconstruction.LandmarkPoint]:
    return [
        reconstruction.LandmarkPoint(
            label=label,
            x=float(vertices[index][0]),
            y=float(vertices[index][1]),
            z=float(vertices[index][2]),
            nx=wrong_normal[0],
            ny=wrong_normal[1],
            nz=wrong_normal[2],
        )
        for index, label in enumerate(LANDMARK_ORDER)
    ]


def _make_asymmetric_template() -> trimesh.Trimesh:
    mesh = trimesh.creation.icosphere(subdivisions=4, radius=1.0)
    vertices = np.asarray(mesh.vertices, dtype=np.float64).copy()
    vertices[:, 0] += 0.18 * vertices[:, 1] ** 2
    vertices[:, 1] *= 1.24
    vertices[:, 2] *= 0.83
    return trimesh.Trimesh(vertices=vertices, faces=mesh.faces, process=False)


def test_validate_flame_landmark_mapping_has_exact_21_labels() -> None:
    validated = validate_flame_landmark_mapping(dict(FLAME_LANDMARK_VERTICES))
    assert list(validated.keys()) == LANDMARK_ORDER
    assert len(validated) == 21
    assert set(RIGID_PROCRUSTES_LABELS).issubset(validated)


def test_estimate_similarity_transform_recovers_known_transform() -> None:
    source = np.array(
        [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 2.0, 0.0],
            [0.5, 0.5, 1.0],
        ],
        dtype=np.float64,
    )
    angle = math.radians(32.0)
    rotation = np.array(
        [
            [math.cos(angle), -math.sin(angle), 0.0],
            [math.sin(angle), math.cos(angle), 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    scale = 2.75
    translation = np.array([14.0, -7.5, 3.25], dtype=np.float64)
    target = scale * (source @ rotation.T) + translation

    est_scale, est_rotation, est_translation = reconstruction.estimate_similarity_transform(
        source,
        target,
    )
    transformed = reconstruction._apply_similarity_transform(
        source,
        est_scale,
        est_rotation,
        est_translation,
    )

    assert est_scale == pytest.approx(scale, rel=1e-6, abs=1e-6)
    np.testing.assert_allclose(est_rotation, rotation, atol=1e-6)
    np.testing.assert_allclose(est_translation, translation, atol=1e-6)
    np.testing.assert_allclose(transformed, target, atol=1e-6)


def test_robust_similarity_transform_ignores_single_bad_landmark() -> None:
    source = np.array(
        [
            [0.0, 0.0, 0.0],
            [1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [1.0, 1.0, 0.0],
            [0.5, 0.5, 1.0],
            [1.5, 0.5, 0.5],
            [0.5, 1.5, 0.5],
            [1.5, 1.5, 1.0],
        ],
        dtype=np.float64,
    )
    angle = math.radians(-21.0)
    rotation = np.array(
        [
            [math.cos(angle), -math.sin(angle), 0.0],
            [math.sin(angle), math.cos(angle), 0.0],
            [0.0, 0.0, 1.0],
        ],
        dtype=np.float64,
    )
    target = 12.0 * (source @ rotation.T) + np.array([8.0, -4.0, 3.0])
    target[-1] += np.array([55.0, -30.0, 20.0])

    fit = reconstruction.estimate_robust_similarity_transform(
        source,
        target,
        min_inliers=6,
    )
    transformed = reconstruction._apply_similarity_transform(
        source[:-1],
        fit.scale,
        fit.rotation,
        fit.translation,
    )

    assert len(fit.inlier_indices) == 7
    assert 7 not in fit.inlier_indices.tolist()
    np.testing.assert_allclose(transformed, target[:-1], atol=1e-5)


def test_control_points_use_skull_vertex_normals_not_payload_normals() -> None:
    skull = trimesh.creation.icosphere(subdivisions=2, radius=10.0)
    landmarks = _make_landmarks_from_vertices(np.asarray(skull.vertices))

    skull_ctrl, face_ctrl = reconstruction._control_points(
        skull,
        landmarks,
        sex="M",
        ancestry="global",
        age_range="18-35",
        fstt_k_factor=0.0,
    )

    for index, label in enumerate(LANDMARK_ORDER):
        expected_depth = get_fstt("M", "global", "18-35", label)
        expected_normal = np.asarray(skull.vertex_normals[index], dtype=np.float64)
        expected_normal = expected_normal / np.linalg.norm(expected_normal)

        np.testing.assert_allclose(
            skull_ctrl[index],
            np.asarray(skull.vertices[index], dtype=np.float64),
            atol=1e-6,
        )
        np.testing.assert_allclose(
            face_ctrl[index],
            skull_ctrl[index] + expected_normal * expected_depth,
            atol=1e-5,
        )
        assert not np.allclose(expected_normal, np.array([0.0, 0.0, -1.0]))


def test_control_point_set_records_profile_sensitive_fstt_depths() -> None:
    skull = trimesh.creation.icosphere(subdivisions=2, radius=10.0)
    landmarks = _make_landmarks_from_vertices(np.asarray(skull.vertices))

    male = reconstruction._control_point_set(
        skull,
        landmarks,
        sex="M",
        ancestry="global",
        age_range="18-35",
        fstt_k_factor=0.0,
    )
    female_older = reconstruction._control_point_set(
        skull,
        landmarks,
        sex="F",
        ancestry="latinoamerican",
        age_range="50+",
        fstt_k_factor=0.0,
    )

    assert male.depths_by_label["glabella"] == get_fstt(
        "M",
        "global",
        "18-35",
        "glabella",
    )
    assert female_older.depths_by_label["glabella"] == get_fstt(
        "F",
        "latinoamerican",
        "50+",
        "glabella",
    )
    assert male.depths_by_label != female_older.depths_by_label
    assert set(male.tolerances_by_label) == set(LANDMARK_ORDER)
    assert set(male.region_confidence_by_label) == set(LANDMARK_ORDER)


def test_fstt_soft_weights_downweight_high_residual_lateral_landmarks() -> None:
    residuals = np.full(len(LANDMARK_ORDER), 3.0, dtype=np.float64)
    residuals[LANDMARK_ORDER.index("right_masseter_muscle")] = 45.0

    weights = reconstruction._fstt_soft_constraint_weights(residuals)

    assert weights[LANDMARK_ORDER.index("nasion")] > 0.7
    assert weights[LANDMARK_ORDER.index("right_masseter_muscle")] < 0.2
    assert weights.min() >= reconstruction.ROBUST_LANDMARK_MIN_WEIGHT


@pytest.mark.parametrize(
    ("mutator", "match"),
    [
        (lambda landmarks: landmarks[:-1], "missing="),
        (
            lambda landmarks: [
                *landmarks[:-1],
                landmarks[0]._replace(label=landmarks[0].label),
            ],
            "missing=.*duplicates=",
        ),
        (
            lambda landmarks: [
                *landmarks[:-1],
                landmarks[-1]._replace(label="unknown_point"),
            ],
            "missing=.*unknown=",
        ),
    ],
)
def test_validate_landmarks_rejects_invalid_sets(mutator, match: str) -> None:
    skull = trimesh.creation.icosphere(subdivisions=2, radius=10.0)
    landmarks = _make_landmarks_from_vertices(np.asarray(skull.vertices))

    with pytest.raises(ValueError, match=match):
        reconstruction._validate_landmarks(mutator(landmarks))


def test_select_stabilization_anchors_is_deterministic_and_counted() -> None:
    template = _make_asymmetric_template()
    aligned_vertices = np.asarray(template.vertices, dtype=np.float64)
    aligned_landmarks = aligned_vertices[: len(LANDMARK_ORDER)]

    anchors_first = reconstruction.select_stabilization_anchors(
        aligned_vertices,
        aligned_landmarks,
        count=32,
    )
    anchors_second = reconstruction.select_stabilization_anchors(
        aligned_vertices,
        aligned_landmarks,
        count=32,
    )

    assert anchors_first.shape == (32, 3)
    np.testing.assert_allclose(anchors_first, anchors_second)


def test_prepare_mesh_for_pipeline_preserves_coordinate_bbox() -> None:
    skull = trimesh.creation.box(extents=(12.0, 18.0, 24.0))
    skull.apply_translation([4.0, -3.0, 7.0])
    source_bytes = skull.export(file_type="ply")

    payload, params = prepare_mesh_for_pipeline(
        source_bytes=source_bytes,
        source_format="ply",
        source_key="meshes/case/raw.ply",
    )
    prepared = trimesh.load(io.BytesIO(payload), file_type="ply", process=False)

    assert params["preprocessed_format"] == "ply"
    assert params["preserves_coordinate_system"] is True
    assert params["vertex_count"] == len(prepared.vertices)
    assert params["face_count"] == len(prepared.faces)
    np.testing.assert_allclose(prepared.bounds, skull.bounds, atol=1e-6)


def test_validate_reconstruction_geometry_rejects_implausible_mesh() -> None:
    diagnostics = {
        "rigid_residual_mean_mm": 5.2,
        "rigid_residual_max_mm": 9.1,
        "deformed_to_face_bbox_ratio": [0.52, 1.02, 1.81],
        "component_count": 2,
    }
    vertices = np.array([[0.0, 0.0, 0.0], [1.0, 1.0, 1.0]], dtype=np.float64)
    faces = np.array([[0, 1, 1]], dtype=np.int32)

    with pytest.raises(reconstruction.GeometryValidationError, match="Rejected FLAME reconstruction"):
        reconstruction.validate_reconstruction_geometry(diagnostics, vertices, faces)


def test_reconstruct_flame_smoke_returns_template_topology(monkeypatch) -> None:
    flame_template = _make_asymmetric_template()
    skull = trimesh.Trimesh(
        vertices=np.asarray(flame_template.vertices, dtype=np.float64) * 120.0,
        faces=np.asarray(flame_template.faces, dtype=np.int32),
        process=False,
    )
    landmarks = _make_landmarks_from_vertices(np.asarray(skull.vertices))
    mapping = {label: index for index, label in enumerate(LANDMARK_ORDER)}

    monkeypatch.setattr(
        reconstruction,
        "load_flame_template",
        lambda _path: (
            np.asarray(flame_template.vertices, dtype=np.float64),
            np.asarray(flame_template.faces, dtype=np.int32),
        ),
    )
    monkeypatch.setattr(reconstruction, "FLAME_LANDMARK_VERTICES", mapping)
    monkeypatch.setattr(
        reconstruction,
        "_control_point_set",
        lambda *_args, **_kwargs: (
            reconstruction.ControlPointSet(
                skull_ctrl=np.asarray(skull.vertices[: len(LANDMARK_ORDER)], dtype=np.float64),
                face_ctrl=np.asarray(skull.vertices[: len(LANDMARK_ORDER)], dtype=np.float64),
                depths_by_label={label: 0.0 for label in LANDMARK_ORDER},
                normals_by_label={label: [0.0, 0.0, 1.0] for label in LANDMARK_ORDER},
                tolerances_by_label={
                    label: reconstruction.FSTT_CONSTRAINT_TOLERANCE_MM[label]
                    for label in LANDMARK_ORDER
                },
                region_confidence_by_label={
                    label: reconstruction.LANDMARK_REGION_CONFIDENCE[label]
                    for label in LANDMARK_ORDER
                },
            )
        ),
    )

    skull_bytes = skull.export(file_type="ply")
    result = reconstruction.reconstruct_flame_with_metadata(
        skull_mesh_bytes=skull_bytes,
        mesh_format="ply",
        landmarks=landmarks,
        sex="M",
        ancestry="global",
        age_range="18-35",
        fstt_k_factor=0.0,
        flame_model_path="ignored.pkl",
    )

    reconstructed = trimesh.load(
        io.BytesIO(result.ply_bytes),
        file_type="ply",
        process=False,
    )
    result_span = np.ptp(np.asarray(reconstructed.vertices), axis=0)
    skull_span = np.ptp(np.asarray(skull.vertices), axis=0)

    assert len(reconstructed.vertices) == len(flame_template.vertices)
    assert result.procrustes_scale > 0
    assert np.isfinite(result_span).all()
    assert np.max(result_span) < np.max(skull_span) * 2.5
    assert np.max(result_span) > np.max(skull_span) * 0.5
    assert result.diagnostics["anchor_count"] == 32
    assert result.diagnostics["component_count"] == 1
    assert result.diagnostics["rigid_residual_mean_mm"] < 4.5
    assert result.diagnostics["rigid_residual_max_mm"] < 8.0


def test_reconstruct_flame_degrades_bad_mapping_instead_of_failing(monkeypatch) -> None:
    flame_template = _make_asymmetric_template()
    skull = trimesh.Trimesh(
        vertices=np.asarray(flame_template.vertices, dtype=np.float64) * 120.0,
        faces=np.asarray(flame_template.faces, dtype=np.int32),
        process=False,
    )
    landmarks = _make_landmarks_from_vertices(np.asarray(skull.vertices))
    bad_mapping = {
        label: index + 80 for index, label in enumerate(LANDMARK_ORDER)
    }

    monkeypatch.setattr(
        reconstruction,
        "load_flame_template",
        lambda _path: (
            np.asarray(flame_template.vertices, dtype=np.float64),
            np.asarray(flame_template.faces, dtype=np.int32),
        ),
    )
    monkeypatch.setattr(reconstruction, "FLAME_LANDMARK_VERTICES", bad_mapping)
    monkeypatch.setattr(
        reconstruction,
        "_control_point_set",
        lambda *_args, **_kwargs: (
            reconstruction.ControlPointSet(
                skull_ctrl=np.asarray(skull.vertices[: len(LANDMARK_ORDER)], dtype=np.float64),
                face_ctrl=np.asarray(skull.vertices[: len(LANDMARK_ORDER)], dtype=np.float64),
                depths_by_label={label: 0.0 for label in LANDMARK_ORDER},
                normals_by_label={label: [0.0, 0.0, 1.0] for label in LANDMARK_ORDER},
                tolerances_by_label={
                    label: reconstruction.FSTT_CONSTRAINT_TOLERANCE_MM[label]
                    for label in LANDMARK_ORDER
                },
                region_confidence_by_label={
                    label: reconstruction.LANDMARK_REGION_CONFIDENCE[label]
                    for label in LANDMARK_ORDER
                },
            )
        ),
    )

    skull_bytes = skull.export(file_type="ply")
    result = reconstruction.reconstruct_flame_with_metadata(
        skull_mesh_bytes=skull_bytes,
        mesh_format="ply",
        landmarks=landmarks,
        sex="M",
        ancestry="global",
        age_range="18-35",
        fstt_k_factor=0.0,
        flame_model_path="ignored.pkl",
    )

    reconstructed = trimesh.load(
        io.BytesIO(result.ply_bytes),
        file_type="ply",
        process=False,
    )

    assert len(reconstructed.vertices) == len(flame_template.vertices)
    assert np.isfinite(np.asarray(reconstructed.vertices)).all()
    assert result.diagnostics["quality_status"] in {"degraded", "fallback"}
    assert result.diagnostics["warning_message"]
    assert result.diagnostics["confidence_score"] < 0.72
    assert result.diagnostics["confidence_reasons"]
    assert result.diagnostics["human_shape_validation"]["passed"] is True
