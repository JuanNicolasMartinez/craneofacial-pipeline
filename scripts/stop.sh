#!/usr/bin/env bash
# stop.sh — Para todos los contenedores, preservando los volúmenes (DB y Redis).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}Craneofacial Pipeline — Stop${NC}"
echo "────────────────────────────────────────"

docker compose down

echo -e "${GREEN}Stack parado.${NC} Los volúmenes (DB, Redis) se conservan."
echo ""
echo -e "Para borrar también los datos: ${YELLOW}./scripts/reset.sh${NC}"
