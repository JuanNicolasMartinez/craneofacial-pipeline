#!/usr/bin/env bash
# rebuild.sh — Reconstruye imágenes de uno o todos los servicios sin bajar los datos.
#              Necesario después de cambiar dependencias Python o pnpm.
# Uso:
#   ./scripts/rebuild.sh              → reconstruye api y worker (los más comunes)
#   ./scripts/rebuild.sh frontend     → solo el frontend
#   ./scripts/rebuild.sh api worker   → api y worker explícitamente
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

SERVICES=("${@:-api worker}")

echo -e "${BOLD}Reconstruyendo: ${SERVICES[*]}${NC}"
docker compose build "${SERVICES[@]}"

echo ""
echo -e "${GREEN}Imágenes reconstruidas.${NC} Reiniciando servicios..."
docker compose up -d "${SERVICES[@]}"

echo -e "${CYAN}Listo.${NC}"
