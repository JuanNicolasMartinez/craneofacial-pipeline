#!/usr/bin/env bash
# setup.sh — Primera vez: verifica requisitos, crea .env.local si no existen,
#             construye las imágenes Docker y aplica las migraciones Alembic.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ── Colores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()    { echo -e "${CYAN}[info]${NC}  $*"; }
success() { echo -e "${GREEN}[ok]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC}  $*"; }
error()   { echo -e "${RED}[error]${NC} $*" >&2; }

echo -e "${BOLD}Craneofacial Pipeline — Setup${NC}"
echo "────────────────────────────────────────"

# ── 1. Verificar Docker ────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  error "Docker no encontrado. Instálalo desde https://docs.docker.com/get-docker/"
  exit 1
fi

if ! docker compose version &>/dev/null; then
  error "Docker Compose v2 no encontrado. Actualiza Docker Desktop."
  exit 1
fi

success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"

# ── 2. Verificar modelo FLAME ──────────────────────────────────────────────────
FLAME_PATH="backend/assets/flame/generic_model.pkl"
if [[ ! -f "$FLAME_PATH" ]]; then
  warn "Modelo FLAME no encontrado en $FLAME_PATH"
  warn "Regístrate en https://flame.is.tue.mpg.de y descarga generic_model.pkl"
  warn "El pipeline (pasos 6-8) fallará hasta que el archivo esté presente."
  warn "El resto del stack levantará con normalidad."
fi

# ── 3. Crear .env.local si no existen ─────────────────────────────────────────
if [[ ! -f "backend/.env.local" ]]; then
  info "Creando backend/.env.local con valores de desarrollo..."
  cat > backend/.env.local <<'ENV'
DATABASE_URL=postgresql+asyncpg://dev:dev@postgres:5432/craneofacial
REDIS_URL=redis://redis:6379/0
R2_ACCOUNT_ID=dev_mock
R2_ACCESS_KEY_ID=dev_mock
R2_SECRET_ACCESS_KEY=dev_mock
R2_BUCKET_NAME=craneofacial-dev
FLAME_MODEL_PATH=/app/assets/flame/generic_model.pkl
ENV
  success "backend/.env.local creado"
else
  info "backend/.env.local ya existe, se conserva"
fi

if [[ ! -f "frontend/.env.local" ]]; then
  info "Creando frontend/.env.local..."
  cat > frontend/.env.local <<'ENV'
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
ENV
  success "frontend/.env.local creado"
else
  info "frontend/.env.local ya existe, se conserva"
fi

# ── 4. Crear directorio de assets ─────────────────────────────────────────────
mkdir -p backend/assets/flame

# ── 5. Build de imágenes ───────────────────────────────────────────────────────
info "Construyendo imágenes Docker (puede tardar 3–5 min la primera vez)..."
docker compose build

success "Imágenes construidas"

# ── 6. Levantar servicios de infraestructura ──────────────────────────────────
info "Levantando postgres y redis..."
docker compose up -d postgres redis

info "Esperando a que postgres esté listo..."
until docker compose exec -T postgres pg_isready -U dev -d craneofacial &>/dev/null; do
  sleep 1
done
success "Postgres listo"

# ── 7. Aplicar migraciones ────────────────────────────────────────────────────
info "Aplicando migraciones Alembic..."

# Si no hay ninguna versión generada, autogenerarla primero
VERSIONS_DIR="backend/alembic/versions"
if [[ -z "$(ls "$VERSIONS_DIR"/*.py 2>/dev/null)" ]]; then
  info "No hay migraciones, generando la migración inicial..."
  docker compose run --rm api sh -c "alembic revision --autogenerate -m 'initial schema'"
  success "Migración inicial generada"
fi

docker compose run --rm api sh -c "alembic upgrade head"
success "Migraciones aplicadas"

# ── 8. Bajar servicios temporales ─────────────────────────────────────────────
docker compose down

echo ""
echo -e "${GREEN}${BOLD}Setup completo.${NC}"
echo -e "Ahora ejecuta: ${CYAN}./scripts/start.sh${NC}"
