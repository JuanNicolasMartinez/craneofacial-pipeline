# Imagen todo-en-uno: api + worker + Redis embebido + SPA estático.
#
# Pensada para plataformas de free trial donde solo se puede desplegar UN
# servicio con UN puerto (Render, Railway, Koyeb, Fly, Hugging Face Spaces).
# El despliegue por piezas separadas sigue documentado en
# `docs/arquitecture/DEPLOY.md`; este artefacto no lo reemplaza.

# ── Etapa 1: build del SPA ────────────────────────────────────────────────────
FROM node:22-alpine AS frontend

WORKDIR /build
RUN npm install -g pnpm

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

# Sin VITE_API_URL/VITE_WS_URL el SPA habla con su propio origen, que es
# exactamente lo que hace falta aquí: api y frontend comparten dominio.
ARG VITE_API_URL
ARG VITE_WS_URL
RUN pnpm build

# ── Etapa 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

# libgomp/libgl: procesamiento de mallas headless (trimesh/scipy).
# redis-server: broker local cuando no hay Redis externo.
# curl: healthcheck y descarga opcional del modelo FLAME.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libgl1 \
    libglu1-mesa \
    redis-server \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml .
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir .

COPY backend/ .
COPY --from=frontend /build/dist /app/frontend
# Si hay un generic_model.pkl en deploy/flame/, viaja dentro de la imagen:
# es la única vía cuando la plataforma no tiene disco persistente ni permite
# descargarlo (un Space privado, por ejemplo).
COPY deploy/ /opt/deploy/
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Valores por defecto del modo autocontenido. Cada uno se sobrescribe con una
# variable de entorno: ver `docs/arquitecture/DEPLOY_FREE.md`.
ENV PORT=8000 \
    DATA_DIR=/data \
    PYTHONUNBUFFERED=1 \
    STORAGE_BACKEND=local \
    FRONTEND_DIST_PATH=/app/frontend \
    FLAME_MODEL_PATH=/data/flame/generic_model.pkl \
    CELERY_CONCURRENCY=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["/usr/local/bin/entrypoint.sh"]
