#!/usr/bin/env bash
# shell.sh — Abre una shell interactiva dentro de un contenedor.
# Uso:
#   ./scripts/shell.sh          → shell en el contenedor api
#   ./scripts/shell.sh worker   → shell en el contenedor worker
#   ./scripts/shell.sh postgres → psql en postgres
#   ./scripts/shell.sh redis    → redis-cli en redis
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-api}"

case "$SERVICE" in
  postgres)
    docker compose exec postgres psql -U dev -d craneofacial
    ;;
  redis)
    docker compose exec redis redis-cli
    ;;
  api|worker|frontend)
    docker compose exec "$SERVICE" bash
    ;;
  *)
    echo "Servicio desconocido: $SERVICE"
    echo "Opciones: api (default), worker, frontend, postgres, redis"
    exit 1
    ;;
esac
