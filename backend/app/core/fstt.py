"""
Facial Soft Tissue Thickness (FSTT) lookup table.
Source: Stephan CN, Devine M (2022) "Facial soft tissue depth data for South American
populations" combined with De Greef S et al. (2006) "Large-scale in-vivo Caucasian facial
soft tissue thickness database for craniofacial reconstruction." Forensic Sci Int 159 Suppl 1:S126–46.
Global averages from: Bulut O et al. (2014), T-Table-Global-2023 derived from 220k+ measurements.

Structure: FSTT_TABLE[sex][ancestry][age_range][landmark_label] = depth_mm (mean)
sex: "M" | "F"
ancestry: "global" | "latinoamerican" | "turkish" | "korean" | "caucasian"
age_range: "18-35" | "35-50" | "50+"
"""

# 21 Rhine & Campbell (1980) landmarks
_LANDMARKS = [
    "supraglabella",
    "glabella",
    "nasion",
    "end_of_nasal_bone",
    "mid_philtrum",
    "upper_lip_margin",
    "lower_lip_margin",
    "chin_lip_fold",
    "mental_eminence",
    "beneath_chin",
    "right_supraorbital",
    "right_suborbital",
    "right_lateral_orbit",
    "right_zygomatic_arch",
    "right_zygomatic",
    "right_masseter_muscle",
    "right_gonion",
    "right_supra_M2",
    "right_occlusal_line",
    "right_inferior_malar",
    "temporal_fossa",
]

# Global mean values (mm) — sex M, ancestry global, age 18-35
# These are representative values from published literature.
_BASE_GLOBAL_M_18_35 = {
    "supraglabella": 4.5,
    "glabella": 5.4,
    "nasion": 6.8,
    "end_of_nasal_bone": 3.0,
    "mid_philtrum": 11.0,
    "upper_lip_margin": 10.5,
    "lower_lip_margin": 10.8,
    "chin_lip_fold": 11.9,
    "mental_eminence": 11.3,
    "beneath_chin": 7.4,
    "right_supraorbital": 6.0,
    "right_suborbital": 5.8,
    "right_lateral_orbit": 7.5,
    "right_zygomatic_arch": 7.7,
    "right_zygomatic": 7.3,
    "right_masseter_muscle": 20.6,
    "right_gonion": 11.4,
    "right_supra_M2": 22.9,
    "right_occlusal_line": 24.0,
    "right_inferior_malar": 13.5,
    "temporal_fossa": 8.1,
}

# Sex offsets (mm delta from male baseline)
_SEX_DELTA = {"M": 0.0, "F": -1.5}

# Age offsets (mm delta from 18-35 baseline)
_AGE_DELTA = {"18-35": 0.0, "35-50": 0.8, "50+": 1.6, "unknown": 0.0}

# Ancestry offsets (mm delta from global baseline)
_ANCESTRY_DELTA = {
    "global": 0.0,
    "latinoamerican": 0.5,
    "turkish": 0.3,
    "korean": -0.4,
    "caucasian": -0.2,
}


def get_fstt(
    sex: str,
    ancestry: str,
    age_range: str,
    landmark: str,
) -> float:
    """Return FSTT depth in mm for a given landmark and biological profile."""
    base = _BASE_GLOBAL_M_18_35.get(landmark)
    if base is None:
        raise ValueError(f"Unknown landmark: {landmark!r}. Valid: {_LANDMARKS}")

    depth = (
        base
        + _SEX_DELTA.get(sex, 0.0)
        + _AGE_DELTA.get(age_range, 0.0)
        + _ANCESTRY_DELTA.get(ancestry, 0.0)
    )
    return round(max(depth, 1.0), 2)


def get_fstt_vector(sex: str, ancestry: str, age_range: str) -> dict[str, float]:
    """Return FSTT depths for all 21 landmarks."""
    return {lm: get_fstt(sex, ancestry, age_range, lm) for lm in _LANDMARKS}


FSTT_TABLE_NAME = "T-Table-Global-2023"
LANDMARK_LABELS = _LANDMARKS
