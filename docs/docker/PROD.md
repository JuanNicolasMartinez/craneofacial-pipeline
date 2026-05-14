# Docker — producción

En producción el stack se divide: Railway corre `api` y `worker`, Vercel sirve el frontend, Supabase provee Postgres, Railway Redis provee Redis.

No se usa `docker-compose.prod.yml` para deploy — Railway construye desde el `Dockerfile` directamente.

---

## Qué se containeriza en prod

| Servicio | Dónde corre | Cómo se despliega |
|---|---|---|
| `api` | Railway | Dockerfile detectado automáticamente |
| `worker` | Railway (segundo servicio) | mismo Dockerfile, distinto start command |
| `postgres` | Supabase | no containerizado |
| `redis` | Railway Redis plugin | no containerizado |
| `frontend` | Vercel | build estático, sin Docker |

---

## Railway — configuración

### Servicio `api`

En Railway → New Service → GitHub repo → seleccionar `/backend` como root.

**Start command:**
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Railway inyecta `$PORT` automáticamente. No hardcodear 8000 en prod.

**Variables de entorno en Railway:**
```
DATABASE_URL         postgresql+asyncpg://postgres.[ref]:[pwd]@pooler.supabase.com:6543/postgres
REDIS_URL            redis://default:[pwd]@[host]:6379
R2_ACCOUNT_ID        [desde Cloudflare dashboard]
R2_ACCESS_KEY_ID     [desde Cloudflare dashboard]
R2_SECRET_ACCESS_KEY [desde Cloudflare dashboard]
R2_BUCKET_NAME       craneofacial-prod
FLAME_MODEL_PATH     /app/assets/flame/generic_model.pkl
```

**El modelo FLAME en prod:** no se puede montar como volumen en Railway.
Opciones (en orden de preferencia):
1. Descargarlo en el `Dockerfile` durante el build (si el modelo es público) — no aplica (requiere registro)
2. Subirlo a R2 y descargarlo en el startup script antes de arrancar uvicorn
3. Incluirlo en el repo con Git LFS (no recomendado, 140 MB en el repo)

**Opción recomendada — startup script:**
```bash
# backend/scripts/start.sh
#!/bin/sh
if [ ! -f "$FLAME_MODEL_PATH" ]; then
  echo "Descargando modelo FLAME..."
  aws s3 cp s3://$R2_BUCKET_NAME/models/generic_model.pkl $FLAME_MODEL_PATH \
    --endpoint-url https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com
fi
alembic upgrade head
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Start command en Railway: `sh backend/scripts/start.sh`

### Servicio `worker`

Segundo servicio en Railway, mismo repo, mismo Dockerfile.

**Start command:**
```
sh -c "python -c 'from app.core.flame_loader import preload_flame; preload_flame()' && \
       celery -A app.workers.celery_app worker --loglevel=info -Q mesh_queue,compute_queue,export_queue"
```

Mismas variables de entorno que `api`.

### Railway Redis

En Railway → New → Database → Redis.
Railway inyecta `REDIS_URL` automáticamente si el servicio Redis está en el mismo proyecto.

---

## Vercel — configuración

En Vercel → New Project → GitHub repo → **Root Directory: `frontend`**.

**Build settings:**
```
Build command:   npm run build
Output dir:      dist
Install command: npm install
```

**Variables de entorno en Vercel:**
```
VITE_API_URL   https://[tu-api].railway.app
VITE_WS_URL    wss://[tu-api].railway.app
```

Vercel detecta Vite automáticamente. No necesita `vercel.json` para este setup.

---

## `docker-compose.prod.yml`

Solo útil para smoke testing de la imagen de prod en local antes de hacer deploy.

```yaml
# Uso: docker compose -f docker-compose.prod.yml up
services:
  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - FLAME_MODEL_PATH=/app/assets/flame/generic_model.pkl
    volumes:
      - ./backend/assets:/app/assets

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    command: celery -A app.workers.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./backend/assets:/app/assets
```

Requiere un `.env` en la raíz con las variables de prod reales. **Nunca commitear ese `.env`.**

---

## .dockerignore

```
# backend/.dockerignore
__pycache__/
*.pyc
.env*
.git
.pytest_cache
assets/flame/          # el .pkl no va en la imagen, se monta o descarga en startup
```

```
# frontend/.dockerignore
node_modules/
dist/
.env*
.git
```
