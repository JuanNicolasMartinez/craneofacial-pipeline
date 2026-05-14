#!/usr/bin/env bash
# reset.sh — Para los contenedores y ELIMINA los volúmenes (DB + Redis).
#             Útil para empezar desde cero en desarrollo.
#             ADVERTENCIA: borra todos los datos locales.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

echo -e "${BOLD}${RED}Craneofacial Pipeline — Reset${NC}"
echo "────────────────────────────────────────"
echo -e "${YELLOW}ADVERTENCIA: Esto borra la base de datos local y la cola de Redis.${NC}"
echo -n "¿Continuar? [s/N] "
read -r CONFIRM

if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Cancelado."
  exit 0
fi

docker compose down -v

echo ""
echo -e "${GREEN}Volúmenes eliminados.${NC}"
echo -e "Vuelve a ejecutar ${YELLOW}./scripts/setup.sh${NC} para re-inicializar."
