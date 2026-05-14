#!/usr/bin/env bash
# logs.sh — Muestra logs de uno o todos los servicios en tiempo real.
# Uso:
#   ./scripts/logs.sh           → todos los servicios
#   ./scripts/logs.sh api       → solo la API
#   ./scripts/logs.sh worker    → solo el worker Celery
#   ./scripts/logs.sh frontend  → solo el frontend Vite
#   ./scripts/logs.sh postgres  → solo Postgres

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-}"

if [[ -n "$SERVICE" ]]; then
  docker compose logs -f "$SERVICE"
else
  docker compose logs -f
fi
