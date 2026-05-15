# Docker — desarrollo local

Levanta todo el stack con un solo comando. No necesitas instalar Python, Node, Postgres ni Redis en tu máquina.

## Requisitos previos

- Docker Desktop (Mac/Windows) o Docker Engine + Compose plugin (Linux)
- El archivo `backend/assets/flame/generic_model.pkl` descargado manualmente
  → Registro gratuito en https://flame.is.tue.mpg.de → descargar `generic_model.pkl`

## Arranque

```bash
# Primera vez (construye imágenes, tarda 3–5 min por las deps Python pesadas)
docker compose up --build

# Siguientes veces
docker compose up

# Solo en background
docker compose up -d
```

## Servicios que levanta

| URL | Servicio |
|---|---|
| `http://localhost:5173` | Frontend (Vite dev server con HMR) |
| `http://localhost:8000` | API FastAPI |
| `http://localhost:8000/docs` | Swagger UI (OpenAPI) |
| `localhost:5432` | Postgres |
| `localhost:6379` | Redis |

## Variables de entorno locales

Crea `backend/.env.local` antes de arrancar (no se commitea):

```env
DATABASE_URL=postgresql+asyncpg://dev:dev@postgres:5432/craneofacial
REDIS_URL=redis://redis:6379/0
R2_ACCOUNT_ID=dev_mock
R2_ACCESS_KEY_ID=dev_mock
R2_SECRET_ACCESS_KEY=dev_mock
R2_BUCKET_NAME=craneofacial-dev
FLAME_MODEL_PATH=/app/assets/flame/generic_model.pkl
```

Para R2 en local puedes usar el mock (las operaciones de storage fallarán silenciosamente)
o levantar un bucket real de Cloudflare R2 con credenciales reales.

## Migraciones

Las migraciones corren automáticamente al iniciar el servicio `api`:

```yaml
# en docker-compose.yml
command: sh -c "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
```

Para correr migraciones manualmente:

```bash
docker compose exec api alembic upgrade head
docker compose exec api alembic revision --autogenerate -m "descripción"
```

## Comandos útiles

```bash
# Ver logs de un servicio específico
docker compose logs -f api
docker compose logs -f worker

# Abrir shell en el contenedor del api
docker compose exec api bash

# Reiniciar solo el worker (sin reconstruir)
# Normalmente no hace falta en local: el worker se auto-recarga al cambiar .py
docker compose restart worker

# Parar todo y eliminar volúmenes (BORRA la DB local)
docker compose down -v

# Reconstruir solo el backend (después de cambiar deps Python)
docker compose build api worker
```

## Recarga en caliente

- **Backend:** `--reload` en uvicorn detecta cambios en `backend/app/` y recarga automáticamente
- **Workers Celery:** en local corren bajo `watchmedo auto-restart`, así que los cambios en `backend/app/**/*.py` reinician el worker automáticamente. Si cambias dependencias Python o el `docker-compose.yml`, sí necesitas:
  ```bash
  docker compose build api worker
  docker compose up -d api worker
  ```
- **Frontend:** Vite HMR funciona con el volumen montado

## Volúmenes

```yaml
volumes:
  postgres_data:    # persiste la DB entre reinicios
  redis_data:       # persiste la cola entre reinicios (opcional)
```

`docker compose down` conserva los volúmenes.
`docker compose down -v` los elimina (DB vacía al volver a subir).
