"""
Canonical FLAME landmark mapping used by reconstruction.

The values below point to the neutral FLAME template after trimming it to the
largest connected surface component. The mapping is owned by the backend and is
exposed read-only through the local dev calibration endpoints.
"""
from __future__ import annotations

from collections import Counter

from app.core.fstt import LANDMARK_LABELS

LANDMARK_ORDER = list(LANDMARK_LABELS)

RIGID_PROCRUSTES_LABELS = [
    "supraglabella",
    "glabella",
    "nasion",
    "end_of_nasal_bone",
    "mental_eminence",
    "beneath_chin",
    "right_supraorbital",
    "right_suborbital",
    "right_lateral_orbit",
    "right_zygomatic_arch",
    "right_zygomatic",
    "right_masseter_muscle",
    "right_gonion",
    "temporal_fossa",
]

# Initial calibrated mapping. The dev-only FLAME calibration tool can be used
# to inspect and refine these correspondences, then commit the updated module.
FLAME_LANDMARK_VERTICES: dict[str, int] = {
    "supraglabella": 3290,
    "glabella": 3312,
    "nasion": 3246,
    "end_of_nasal_bone": 553,
    "mid_philtrum": 3372,
    "upper_lip_margin": 3375,
    "lower_lip_margin": 3011,
    "chin_lip_fold": 2374,
    "mental_eminence": 3371,
    "beneath_chin": 2975,
    "right_supraorbital": 2560,
    "right_suborbital": 12,
    "right_lateral_orbit": 3268,
    "right_zygomatic_arch": 2474,
    "right_zygomatic": 2973,
    "right_masseter_muscle": 3315,
    "right_gonion": 2032,
    "right_supra_M2": 2224,
    "right_occlusal_line": 2376,
    "right_inferior_malar": 1898,
    "temporal_fossa": 3226,
}


def validate_flame_landmark_mapping(mapping: dict[str, int]) -> dict[str, int]:
    """Fail fast if the checked-in mapping drifts from the canonical 21 labels."""
    expected = set(LANDMARK_ORDER)
    counts = Counter(mapping.keys())

    duplicates = sorted(label for label, count in counts.items() if count > 1)
    missing = sorted(label for label in LANDMARK_ORDER if label not in mapping)
    extras = sorted(label for label in mapping if label not in expected)

    if duplicates or missing or extras or len(mapping) != len(LANDMARK_ORDER):
        problems: list[str] = []
        if missing:
            problems.append(f"missing={missing}")
        if duplicates:
            problems.append(f"duplicates={duplicates}")
        if extras:
            problems.append(f"unknown={extras}")
        if len(mapping) != len(LANDMARK_ORDER):
            problems.append(f"count={len(mapping)} expected={len(LANDMARK_ORDER)}")
        raise ValueError(
            "Invalid FLAME landmark mapping: " + ", ".join(problems)
        )

    for label, index in mapping.items():
        if not isinstance(index, int) or index < 0:
            raise ValueError(
                f"Invalid FLAME landmark vertex for {label!r}: {index!r}"
            )

    return {label: mapping[label] for label in LANDMARK_ORDER}


FLAME_LANDMARK_VERTICES = validate_flame_landmark_mapping(FLAME_LANDMARK_VERTICES)
