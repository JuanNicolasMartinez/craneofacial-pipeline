#!/usr/bin/env bash
# Arranque del contenedor todo-en-uno: Redis (si hace falta), migraciones,
# worker Celery y api. Un solo puerto, un solo proceso supervisor.
set -euo pipefail

PORT="${PORT:-8000}"
DATA_DIR="${DATA_DIR:-/data}"

log() { echo "[entrypoint] $*"; }

mkdir -p "$DATA_DIR"

# ── Redis ─────────────────────────────────────────────────────────────────────
# Con REDIS_URL definida (Upstash, Redis gestionado…) se usa esa. Sin ella,
# arrancamos uno local: los datos son efímeros por diseño (cola de tareas y
# mensajes de progreso), así que no se persiste nada a disco.
if [[ -z "${REDIS_URL:-}" ]]; then
  log "REDIS_URL sin definir → arrancando redis-server local en 127.0.0.1:6379"
  redis-server --daemonize yes --bind 127.0.0.1 --port 6379 \
    --save '' --appendonly no --maxmemory 128mb --maxmemory-policy allkeys-lru
  export REDIS_URL="redis://127.0.0.1:6379/0"

  for _ in $(seq 1 30); do
    redis-cli -h 127.0.0.1 ping &>/dev/null && break
    sleep 0.5
  done
  redis-cli -h 127.0.0.1 ping &>/dev/null || { log "ERROR: redis local no respondió"; exit 1; }
fi

# ── Modelo FLAME (opcional) ───────────────────────────────────────────────────
# Sin él, los pasos 6–8 del pipeline fallan y el resto de la app funciona.
FLAME_MODEL_PATH="${FLAME_MODEL_PATH:-$DATA_DIR/flame/generic_model.pkl}"
export FLAME_MODEL_PATH
if [[ -n "${FLAME_MODEL_URL:-}" && ! -f "$FLAME_MODEL_PATH" ]]; then
  log "Descargando modelo FLAME desde FLAME_MODEL_URL..."
  mkdir -p "$(dirname "$FLAME_MODEL_PATH")"
  if curl -fsSL "$FLAME_MODEL_URL" -o "$FLAME_MODEL_PATH.part"; then
    mv "$FLAME_MODEL_PATH.part" "$FLAME_MODEL_PATH"
    log "Modelo FLAME listo en $FLAME_MODEL_PATH"
  else
    rm -f "$FLAME_MODEL_PATH.part"
    log "AVISO: la descarga de FLAME falló; los pasos 6–8 fallarán"
  fi
fi
if [[ ! -f "$FLAME_MODEL_PATH" ]]; then
  log "AVISO: no hay modelo FLAME en $FLAME_MODEL_PATH (pasos 6–8 fallarán)"
fi

# ── Migraciones ───────────────────────────────────────────────────────────────
# Igual que en el despliegue por piezas: las aplica el api, nunca el worker.
log "Aplicando migraciones Alembic..."
alembic upgrade head

# ── Procesos ──────────────────────────────────────────────────────────────────
log "Arrancando worker Celery (concurrencia ${CELERY_CONCURRENCY:-1})..."
celery -A app.workers.celery_app worker \
  --loglevel="${CELERY_LOGLEVEL:-info}" \
  -Q mesh_queue,compute_queue,export_queue \
  --concurrency="${CELERY_CONCURRENCY:-1}" &
WORKER_PID=$!

log "Arrancando api en 0.0.0.0:${PORT}..."
uvicorn app.main:app --host 0.0.0.0 --port "$PORT" &
API_PID=$!

shutdown() {
  log "Señal recibida, parando procesos..."
  kill "$WORKER_PID" "$API_PID" 2>/dev/null || true
  wait "$WORKER_PID" "$API_PID" 2>/dev/null || true
  exit 0
}
trap shutdown TERM INT

# Si cualquiera de los dos muere, salimos para que la plataforma reinicie el
# contenedor entero en vez de dejarlo a medias.
wait -n "$WORKER_PID" "$API_PID"
EXIT_CODE=$?
log "Un proceso terminó (código $EXIT_CODE); parando el contenedor."
kill "$WORKER_PID" "$API_PID" 2>/dev/null || true
exit "$EXIT_CODE"
