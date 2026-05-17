# Docker — servicios

Qué hace cada servicio, por qué existe su imagen, y sus dependencias.

---

## `api` — FastAPI

**Imagen:** `backend/Dockerfile` (target `api`)
**Comando:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000`
**Puerto:** 8000

Sirve los endpoints REST y el WebSocket. Corre las migraciones de Alembic antes de arrancar.

**Depende de:** `postgres`, `redis`

**Por qué misma imagen que `worker`:** comparten el mismo código Python y las mismas dependencias. Construir una sola imagen reduce tiempo de build y garantiza que api y worker tienen exactamente las mismas versiones de librerías.

---

## `worker` — Celery

**Imagen:** `backend/Dockerfile` (mismo target, distinto comando)
**Comando:** `watchmedo auto-restart --directory=/app/app --pattern=*.py --recursive -- celery -A app.workers.celery_app worker --loglevel=info -Q mesh_queue,compute_queue,export_queue`
**Puerto:** ninguno (solo consume de Redis)

Ejecuta los pasos 2, 5–9 del pipeline en background. En local se auto-reinicia al cambiar archivos Python del backend para evitar correr código viejo durante calibración y debugging.

**Depende de:** `redis`, `postgres`

**Colas:**

| Cola | Workers que la consumen | Pasos |
|---|---|---|
| `mesh_queue` | `mesh_worker` | 2 |
| `compute_queue` | `align_worker`, `tps_worker` | 5, 6, 7, 8 |
| `export_queue` | `export_worker` | 9 |

En local corre un solo proceso Celery que consume las tres colas.
En prod se puede escalar `compute_queue` con más réplicas si el pipeline tarda mucho.

---

## `postgres` — Base de datos

**Imagen:** `postgres:16-alpine`
**Puerto:** 5432
**Solo en local.** En producción la DB corre aparte — autoalojada o gestionada
(ver `docs/arquitecture/DB.md` y `docs/arquitecture/DEPLOY.md`).

Volumen `postgres_data` persiste los datos entre reinicios de Docker.

---

## `redis` — Broker + canal WS

**Imagen:** `redis:7-alpine`
**Puerto:** 6379

Dos roles simultáneos:
1. **Broker de Celery:** las tasks se encolan aquí
2. **Canal de WebSocket:** los workers publican progreso aquí, la API lo lee y hace push al browser

En producción Redis corre aparte — como contenedor propio o servicio gestionado.
La `REDIS_URL` cambia pero el comportamiento es idéntico.

---

## `frontend` — Vite dev server

**Imagen:** `frontend/Dockerfile`
**Puerto:** 5173
**Solo en local** como contenedor. En producción no hay contenedor de frontend:
se publica el build estático (`dist/`) en un servidor web o CDN.

El Dockerfile del frontend solo existe para poder levantar todo con `docker compose up` sin instalar Node localmente. El volumen montado (`./frontend:/app`) garantiza HMR.

---

## `docker-compose.yml` completo

```yaml
services:

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: craneofacial
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d craneofacial"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/assets:/app/assets
    env_file:
      - ./backend/.env.local
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: >
      watchmedo auto-restart
      --directory=/app/app
      --pattern=*.py
      --recursive
      --
      celery -A app.workers.celery_app worker
      --loglevel=info
      -Q mesh_queue,compute_queue,export_queue
      --concurrency=2
    volumes:
      - ./backend:/app
      - ./backend/assets:/app/assets
    env_file:
      - ./backend/.env.local
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
      - VITE_WS_URL=ws://localhost:8000

volumes:
  postgres_data:
  redis_data:
```

---

## `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Deps del sistema conservadas para librerías de procesamiento de mallas en modo headless
RUN apt-get update && apt-get install -y \
    libgomp1 \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libglu1-mesa \
    && rm -rf /var/lib/apt/lists/*

# Dependencias Python (cacheadas si pyproject.toml no cambia)
COPY pyproject.toml .
RUN pip install --no-cache-dir -e ".[dev]"

COPY . .

# FLAME se monta como volumen, no se incluye en la imagen
# El .pkl va en backend/assets/flame/generic_model.pkl (gitignored)
```

**Por qué `python:3.11-slim` y no `alpine`:** el stack científico de geometría 3D usado por el worker tiene binarios precompilados para glibc (Debian/Ubuntu). Alpine usa musl libc — varios wheels de PyPI no son compatibles y requerirían compilar desde fuente.

**Por qué las deps del sistema (`libgl1`, `libgomp1`):** se mantienen para procesamiento de mallas en modo headless y para paralelismo de NumPy/SciPy.

---

## `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

`--host 0.0.0.0` es necesario para que Vite sea accesible desde fuera del contenedor.
