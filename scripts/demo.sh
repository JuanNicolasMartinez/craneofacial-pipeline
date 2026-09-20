#!/usr/bin/env bash
# demo.sh — Construye y levanta la imagen de despliegue (api + worker + Redis
#           + SPA en un contenedor), la misma que se sube a la nube.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}Craneofacial Pipeline — Demo (contenedor único)${NC}"
echo "────────────────────────────────────────"

if [[ ! -f "backend/assets/flame/generic_model.pkl" ]]; then
  echo -e "${YELLOW}[warn]${NC}  Sin modelo FLAME: el paso 9 del pipeline fallará."
  echo -e "${YELLOW}[warn]${NC}  Descárgalo en https://flame.is.tue.mpg.de → backend/assets/flame/"
fi

echo -e "${CYAN}[info]${NC}  Construyendo la imagen (3–5 min la primera vez)..."
docker compose -f docker-compose.demo.yml up --build -d

echo ""
echo -e "${GREEN}${BOLD}App levantada.${NC}  →  ${CYAN}http://localhost:8000${NC}"
echo ""
echo -e "  API + SPA en el mismo puerto. Swagger: ${CYAN}http://localhost:8000/docs${NC}"
echo -e "  Logs:  ${CYAN}docker compose -f docker-compose.demo.yml logs -f${NC}"
echo -e "  Parar: ${CYAN}docker compose -f docker-compose.demo.yml down${NC}"
