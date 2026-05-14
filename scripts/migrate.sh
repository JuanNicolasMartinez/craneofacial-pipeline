#!/usr/bin/env bash
# migrate.sh — Gestión de migraciones Alembic.
# Uso:
#   ./scripts/migrate.sh                        → aplica migraciones pendientes
#   ./scripts/migrate.sh generate "descripción" → crea una nueva migración
#   ./scripts/migrate.sh status                 → muestra migración actual
#   ./scripts/migrate.sh history               → historial de migraciones
#   ./scripts/migrate.sh downgrade             → revierte la última migración
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CYAN='\033[0;36m'; GREEN='\033[0;32m'; BOLD='\033[1m'; NC='\033[0m'

CMD="${1:-upgrade}"

# Si la API ya está corriendo, usarla directamente; si no, levantar un contenedor temporal.
if docker compose ps api --status running 2>/dev/null | grep -q "running"; then
  RUN="docker compose exec api"
else
  echo -e "${CYAN}API no está corriendo, usando contenedor temporal...${NC}"
  RUN="docker compose run --rm api"
fi

case "$CMD" in
  upgrade|"")
    echo -e "${BOLD}Aplicando migraciones pendientes...${NC}"
    $RUN alembic upgrade head
    echo -e "${GREEN}Migraciones aplicadas.${NC}"
    ;;
  generate)
    DESC="${2:-}"
    if [[ -z "$DESC" ]]; then
      echo "Uso: ./scripts/migrate.sh generate \"descripción del cambio\""
      exit 1
    fi
    echo -e "${BOLD}Generando migración: ${DESC}${NC}"
    $RUN alembic revision --autogenerate -m "$DESC"
    echo -e "${CYAN}Revisa el archivo generado en backend/alembic/versions/ antes de aplicar.${NC}"
    ;;
  status)
    $RUN alembic current
    ;;
  history)
    $RUN alembic history --verbose
    ;;
  downgrade)
    echo -e "\033[1;33mRevirtiendo la última migración...\033[0m"
    $RUN alembic downgrade -1
    echo -e "${GREEN}Revertida.${NC}"
    ;;
  *)
    echo "Comando desconocido: $CMD"
    echo "Uso: ./scripts/migrate.sh [upgrade|generate <desc>|status|history|downgrade]"
    exit 1
    ;;
esac
