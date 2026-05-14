#!/usr/bin/env bash
# start.sh — Levanta el stack completo en segundo plano y abre las URLs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}Craneofacial Pipeline — Start${NC}"
echo "────────────────────────────────────────"

if [[ ! -f "backend/.env.local" ]]; then
  echo -e "\033[0;31m[error]\033[0m Falta backend/.env.local. Ejecuta primero: ./scripts/setup.sh"
  exit 1
fi

docker compose up -d

echo ""
echo -e "${GREEN}${BOLD}Stack levantado.${NC}"
echo ""
echo -e "  Frontend   →  ${CYAN}http://localhost:5173${NC}"
echo -e "  API        →  ${CYAN}http://localhost:8000${NC}"
echo -e "  Swagger    →  ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Postgres   →  localhost:5432  (user: dev / pass: dev)"
echo -e "  Redis      →  localhost:6379"
echo ""
echo -e "Logs:   ${CYAN}./scripts/logs.sh${NC}"
echo -e "Parar:  ${CYAN}./scripts/stop.sh${NC}"

# Abrir el navegador en macOS / Linux
if command -v open &>/dev/null; then
  sleep 3 && open http://localhost:5173 &
elif command -v xdg-open &>/dev/null; then
  sleep 3 && xdg-open http://localhost:5173 &
fi
