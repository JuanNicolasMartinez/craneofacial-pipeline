# Docker — imagen todo-en-uno

El `Dockerfile` de la raíz empaqueta la aplicación completa en **una sola
imagen con un solo puerto**: `api`, `worker`, Redis y el build estático del
SPA. Existe para plataformas de plan gratuito o de prueba, donde no se pueden
desplegar seis piezas por separado.

El procedimiento de despliegue, las variables y los límites están en
`docs/arquitecture/DEPLOY_FREE.md`. Aquí solo se describe el artefacto.

---

## Etapas del build

| Etapa | Base | Qué hace |
|---|---|---|
| `frontend` | `node:22-alpine` | `pnpm install` + `pnpm build` → `dist/` |
| runtime | `python:3.11-slim` | deps del backend, código, `dist/` y `redis-server` |

Sin `VITE_API_URL`/`VITE_WS_URL` en el build, el SPA apunta a su propio origen
— que es lo correcto aquí, porque lo sirve el mismo `api`. Ambos siguen
disponibles como `ARG` si se quiere hornear un dominio distinto.

```bash
docker build -t craneofacial .
docker run -p 8000:8000 -v craneo_data:/data craneofacial
```

---

## Qué hace el entrypoint

`docker/entrypoint.sh`, en orden:

1. Crea `DATA_DIR`.
2. Arranca `redis-server` local **solo si no hay `REDIS_URL`** (sin
   persistencia: la cola y los mensajes de progreso son efímeros por diseño).
3. Descarga el modelo FLAME si `FLAME_MODEL_URL` está definida y el archivo no
   existe todavía. Si no hay modelo, avisa y sigue: fallará el paso 9.
4. Aplica `alembic upgrade head` — igual que el `api` en el despliegue por
   piezas; el worker nunca migra.
5. Lanza el worker Celery (`mesh_queue,compute_queue,export_queue`) y
   `uvicorn` en `$PORT`, y se queda de supervisor: si cualquiera de los dos
   muere, el contenedor termina para que la plataforma lo reinicie entero.

---

## Diferencias con las imágenes de `PROD.md`

| | `backend/Dockerfile` | `Dockerfile` (raíz) |
|---|---|---|
| Procesos | uno (api **o** worker) | api + worker + Redis |
| Frontend | fuera (CDN/nginx) | dentro, servido por el `api` |
| Base de datos | Postgres obligatorio | SQLite por defecto, Postgres con `DATABASE_URL` |
| Escala | réplicas independientes | una instancia |
| Uso | producción | demos y planes gratuitos |

El código es el mismo en ambas: el `api` sirve el SPA solo si encuentra un
build en `FRONTEND_DIST_PATH`, y la base de datos se elige por la URL. No hay
ramas de código específicas del modo de despliegue.
