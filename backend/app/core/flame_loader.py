"""
Lazy singleton for the FLAME parametric facial model.
The .pkl file (~140 MB) is not in the repo — must be downloaded manually from
flame.is.tue.mpg.de (free academic registration) and placed at
backend/assets/flame/generic_model.pkl.
"""
import pickle
from pathlib import Path
from app.core.config import settings

_flame_model = None


def get_flame_model():
    global _flame_model
    if _flame_model is not None:
        return _flame_model

    path = Path(settings.FLAME_MODEL_PATH)
    if not path.exists():
        raise FileNotFoundError(
            f"FLAME model not found at {path}. "
            "Register at flame.is.tue.mpg.de and place generic_model.pkl there."
        )

    with open(path, "rb") as f:
        _flame_model = pickle.load(f, encoding="latin1")

    return _flame_model
