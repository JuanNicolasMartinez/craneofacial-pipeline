# Docker — producción

Cómo se construyen y configuran los artefactos de producción. Este documento
es **agnóstico al proveedor**: describe las imágenes y el build estático, no
dónde se hospedan.

Los requisitos de infraestructura y el procedimiento de despliegue completo
están en `docs/arquitecture/DEPLOY.md`.

---

## Artefactos de producción

| Artefacto | Construido desde | Ejecuta |
|---|---|---|
| Imagen `api` | `backend/Dockerfile` | `uvicorn app.main:app` |
| Imagen `worker` | `backend/Dockerfile` (la misma) | `celery -A app.workers.celery_app worker` |
| Build del frontend | `frontend/` (`pnpm build`) | nada — son archivos estáticos en `dist/` |

`api` y `worker` comparten la **misma imagen**; solo cambia el comando de
arranque. El frontend en producción no es un contenedor: es un directorio
estático que sirve cualquier servidor web o CDN.

Postgres y Redis no se construyen aquí — se proveen como infraestructura
(contenedor estándar o servicio gestionado). Ver `DEPLOY.md`.

---

## Imagen del backend

Un solo `Dockerfile` (`backend/Dockerfile`) sirve para `api` y `worker`.

**Comando de arranque — `api`:**
```
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```
`alembic upgrade head` aplica las migraciones pendientes antes de arrancar.
El puerto se toma de `$PORT` si el entorno lo inyecta; si no, fijar uno explícito.

**Comando de arranque — `worker`:**
```
celery -A app.workers.celery_app worker --loglevel=info \
       -Q mesh_queue,compute_queue,export_queue
```

El `worker` no debe correr `alembic upgrade head` — de eso se encarga `api`.

### Modelo FLAME en la imagen

El `.pkl` de FLAME (~140 MB) **no** se incluye en la imagen (`.dockerignore`
excluye `assets/flame/`). En producción debe estar disponible en la ruta
`FLAME_MODEL_PATH` antes de procesar el pipeline. Opciones:

1. **Montar un volumen** con el archivo (infraestructura propia).
2. **Descargarlo en el arranque** desde el almacenamiento de objetos, antes de
   lanzar el proceso:
   ```sh
   if [ ! -f "$FLAME_MODEL_PATH" ]; then
     aws s3 cp "s3://$R2_BUCKET_NAME/models/generic_model.pkl" "$FLAME_MODEL_PATH" \
       --endpoint-url "$R2_ENDPOINT_URL"
   fi
   ```
3. Incluirlo en el repo con Git LFS — no recomendado (140 MB en el repo).

---

## Build del frontend

```
Build command:   pnpm build      (= tsc -b && vite build)
Output:          dist/
```

`dist/` contiene HTML, JS y CSS estáticos. Se publica en cualquier servidor web,
CDN o servicio de hosting estático. No requiere runtime de Node en producción.

Las variables `VITE_*` se resuelven **en build time** — deben estar definidas
antes de ejecutar `pnpm build`, no en runtime.

---

## Variables de entorno

La lista completa de variables, su significado y los valores recomendados para
producción están en `docs/arquitecture/DEPLOY.md`. Resumen:

- **Backend (`api` y `worker`):** `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`,
  configuración de cookie (`COOKIE_SECURE`, `COOKIE_SAMESITE`), `CORS_ORIGINS`,
  configuración de almacenamiento (`STORAGE_BACKEND` y credenciales S3),
  `FLAME_MODEL_PATH`.
- **Frontend (build time):** `VITE_API_URL`, `VITE_WS_URL`.

`JWT_SECRET_KEY` es obligatoria — sin ella el contenedor no arranca. El `worker`
también la necesita: carga `app.core.config`, que la exige.

---

## `docker-compose.prod.yml`

Útil para *smoke testing* de las imágenes de producción en local antes de
desplegar. No es un archivo de despliegue.

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
      - STORAGE_BACKEND=${STORAGE_BACKEND}
      - R2_ACCOUNT_ID=${R2_ACCOUNT_ID}
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - R2_ENDPOINT_URL=${R2_ENDPOINT_URL}
      - FLAME_MODEL_PATH=/app/assets/flame/generic_model.pkl
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
      - COOKIE_SECURE=${COOKIE_SECURE}
      - COOKIE_SAMESITE=${COOKIE_SAMESITE}
      - CORS_ORIGINS=${CORS_ORIGINS}
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
      - JWT_SECRET_KEY=${JWT_SECRET_KEY}
    volumes:
      - ./backend/assets:/app/assets
```

Requiere un `.env` en la raíz con los valores reales. **Nunca commitear ese `.env`.**

---

## `.dockerignore`

Ambos están en el repo y **deben mantenerse** — evitan que `.env*` y otros
archivos sensibles entren en las imágenes.

```
# backend/.dockerignore
__pycache__/
*.pyc
.env*
.git
.pytest_cache
assets/flame/          # el .pkl no va en la imagen
```

```
# frontend/.dockerignore
node_modules/
dist/
.env*
.git
```
