FROM python:3.11-slim

WORKDIR /app

# Deps del sistema conservadas para librerías de procesamiento de mallas en modo headless
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python (cacheadas si pyproject.toml no cambia)
COPY pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir ".[dev]"

COPY . .

# FLAME se monta como volumen, no se incluye en la imagen
# El .pkl va en backend/assets/flame/generic_model.pkl (gitignored)
