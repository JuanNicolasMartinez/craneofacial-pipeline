# DEPLOY.md

Requisitos y procedimiento para desplegar la aplicación en producción.

Este documento es **agnóstico al proveedor**: describe *qué* necesita la
aplicación para funcionar, no *dónde* hospedarla. Sirve igual para
infraestructura propia (servidores físicos, VPS) que para servicios gestionados.

Lectura previa: `STACK.md` (tecnologías), `DB.md` (datos), `AUTH.md` (sesión),
`docs/docker/PROD.md` (artefactos Docker).

---

## Componentes a desplegar

La aplicación se compone de **seis piezas**. Las tres primeras se ejecutan
desde imágenes/builds del repo; las tres últimas son infraestructura.

| Componente | Qué es | Artefacto |
|---|---|---|
| `api` | Servidor HTTP/WebSocket (FastAPI) | imagen `backend/Dockerfile` |
| `worker` | Procesador del pipeline (Celery) | imagen `backend/Dockerfile` (la misma) |
| `frontend` | SPA estática (React/Vite) | build estático `dist/` |
| Postgres | Base de datos relacional | servidor Postgres ≥ 14 |
| Redis | Broker Celery + canal pub/sub WS | servidor Redis ≥ 7 |
| Almacenamiento de objetos | Mallas y resultados (`.ply`, `.json`) | servicio compatible con S3 |

```
                 ┌───────────┐
   navegador ───▶│ frontend  │  (estático)
       │         └───────────┘
       │  HTTP + WebSocket
       ▼
   ┌───────┐   encola    ┌────────┐
   │  api  │────────────▶│ Redis  │◀───── publica progreso ──┐
   └───┬───┘             └────────┘                          │
       │                      ▲                              │
       │ SQL                  │ consume tareas         ┌──────┴───┐
       ▼                      └────────────────────────│  worker  │
   ┌──────────┐                                        └────┬─────┘
   │ Postgres │◀────────────── SQL ─────────────────────────┘
   └──────────┘
       ▲                                              ┌──────────────┐
       └──────── api y worker leen/escriben ──────────▶│ almacenamiento│
                  archivos (vía S3 API)                │  de objetos   │
                                                       └──────────────┘
```

---

## Requisitos por componente

### `api`
- **Runtime:** la imagen de `backend/Dockerfile` (Python 3.11).
- **Comando:** `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port <PORT>`.
- **Expone:** un puerto HTTP. Debe servirse sobre **HTTPS** en producción
  (TLS terminado en el propio servicio o en un reverse proxy delante).
- **Necesita alcanzar:** Postgres, Redis y el almacenamiento de objetos.
- **Aplica las migraciones** al arrancar (`alembic upgrade head`). Solo `api`
  hace esto, nunca el `worker`.

### `worker`
- **Runtime:** la misma imagen que `api`.
- **Comando:** `celery -A app.workers.celery_app worker --loglevel=info -Q mesh_queue,compute_queue,export_queue`.
- **No expone puertos.**
- **Necesita alcanzar:** Postgres, Redis y el almacenamiento de objetos.
- **Necesita el modelo FLAME** disponible en `FLAME_MODEL_PATH` (ver más abajo).
- Procesa tres colas: `mesh_queue`, `compute_queue`, `export_queue`. Puede ser
  un único proceso que las atienda todas, o procesos separados por cola si se
  quiere escalar — para el volumen actual, uno solo basta.

### `frontend`
- **Build:** `pnpm build` dentro de `frontend/` produce `dist/`.
- **Servir:** `dist/` es estático — cualquier servidor web (nginx, Caddy,
  Apache) o hosting/CDN de estáticos sirve.
- **SPA routing:** la app usa `react-router`. El servidor debe reescribir
  cualquier ruta desconocida a `index.html` (fallback SPA), o el refresco en
  `/login`, `/app`, etc. devolverá 404.
- Las variables `VITE_*` se hornean en **build time** — definirlas antes de
  `pnpm build`.

### Postgres
- Versión ≥ 14. Solo se usa SQL estándar (sin extensiones propietarias).
- La aplicación necesita una `DATABASE_URL` alcanzable con el driver async
  `asyncpg`.
- Recomendado un **connection pooler** (p. ej. PgBouncer) si la instancia es
  pequeña: `api` y `worker` abren conexiones por separado.
- No debe pausarse por inactividad — eso corta las conexiones del `worker`.

### Redis
- Versión ≥ 7. Sirve de broker de Celery **y** de canal pub/sub del WebSocket.
- La aplicación necesita una `REDIS_URL` alcanzable.
- No requiere persistencia: los datos son efímeros (cola de tareas y mensajes
  de progreso). Si Redis se reinicia, los jobs en curso se pierden — aceptable.

### Almacenamiento de objetos
- Cualquier servicio con **API compatible con S3** (el backend usa `boto3`).
- Guarda las mallas subidas (`cases/...`) y los resultados (`results/...`).
- Necesita: endpoint S3, credenciales (access key / secret) y un bucket.
- Alternativa para empezar: `STORAGE_BACKEND=local` guarda en disco y sirve
  los archivos vía `/files/...` desde el propio `api`. Sirve para un despliegue
  de un solo servidor, pero no escala si `api` corre en varias réplicas.

---

## Variables de entorno

### Backend — `api` y `worker`

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | `postgresql+asyncpg://usuario:pwd@host:puerto/db` |
| `REDIS_URL` | sí | `redis://[:pwd@]host:puerto/0` |
| `JWT_SECRET_KEY` | sí | Clave de firma JWT. Generar con `openssl rand -hex 32`. Sin ella el proceso no arranca. |
| `JWT_ALGORITHM` | no | Por defecto `HS256`. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | no | Vida del token en minutos. Por defecto `1440` (24 h). |
| `COOKIE_SECURE` | sí en prod | `true` — la cookie de sesión solo viaja por HTTPS. |
| `COOKIE_SAMESITE` | sí en prod | `lax` si frontend y API comparten dominio; `none` si están en dominios distintos (exige `COOKIE_SECURE=true`). Ver `AUTH.md`. |
| `CORS_ORIGINS` | sí | Lista JSON con el/los dominio(s) exactos del frontend, p. ej. `["https://midominio.tld"]`. El comodín `*` no es válido con credenciales. |
| `PUBLIC_BASE_URL` | sí | URL pública del `api` (se usa para construir URLs de archivos en modo `local`). |
| `STORAGE_BACKEND` | no | `local` (disco) o `r2` (S3-compatible). Por defecto `local`. |
| `STORAGE_LOCAL_PATH` | no | Ruta en disco si `STORAGE_BACKEND=local`. |
| `R2_ENDPOINT_URL` | si `r2` | Endpoint del almacenamiento S3-compatible. |
| `R2_ACCESS_KEY_ID` | si `r2` | Access key del almacenamiento. |
| `R2_SECRET_ACCESS_KEY` | si `r2` | Secret key del almacenamiento. |
| `R2_BUCKET_NAME` | si `r2` | Nombre del bucket. |
| `R2_ACCOUNT_ID` | si `r2` | Identificador de cuenta, si el endpoint lo requiere. |
| `FLAME_MODEL_PATH` | sí | Ruta al `.pkl` de FLAME dentro del contenedor. |

> Las variables del almacenamiento conservan el prefijo `R2_` por compatibilidad
> con el código; aplican a **cualquier** almacenamiento S3-compatible, no solo a
> uno concreto.

El backend **valida al arrancar** que `COOKIE_SAMESITE=none` venga siempre con
`COOKIE_SECURE=true`. Una combinación incoherente aborta el arranque con un
error claro.

### Frontend — build time

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL pública del `api`, p. ej. `https://api.midominio.tld`. |
| `VITE_WS_URL`  | URL del WebSocket, p. ej. `wss://api.midominio.tld`. |

---

## El modelo FLAME

El archivo `generic_model.pkl` (~140 MB) no está en el repo ni en las imágenes
Docker. El `worker` lo necesita en `FLAME_MODEL_PATH` para los pasos 6–8.
Estrategias, según la infraestructura:

- **Volumen montado** — coloca el `.pkl` en un volumen persistente accesible
  por el `worker`. Apropiado para servidores propios.
- **Descarga en el arranque** — un script previo a `celery` descarga el `.pkl`
  desde el almacenamiento de objetos si no está presente. Apropiado cuando el
  contenedor no tiene almacenamiento persistente.

Hasta que el archivo esté disponible, los pasos 6–8 del pipeline fallan; el
resto de la aplicación funciona con normalidad.

---

## Topologías de despliegue

La aplicación no impone una topología. Tres ejemplos válidos:

### A. Un solo servidor (infraestructura propia)

Todo en una máquina con Docker. `docker compose` levanta `api`, `worker`,
`postgres` y `redis`; el `frontend` se sirve estático desde nginx/Caddy, que
además actúa de reverse proxy con TLS hacia `api`.

- Almacenamiento: `STORAGE_BACKEND=local` (disco del servidor) o un servicio
  S3-compatible autoalojado en la misma red.
- Cookie: si nginx publica frontend y API bajo el **mismo dominio**
  (API tras `/api`), usar `COOKIE_SAMESITE=lax`.
- Es la topología más simple; punto único de fallo.

### B. Varios servidores / VPS

`api` y `worker` en uno o varios hosts; Postgres y Redis en hosts dedicados;
el `frontend` estático en un servidor web o CDN.

- Almacenamiento: servicio S3-compatible alcanzable por `api` y `worker`.
- Cookie: depende de si el frontend comparte dominio con la API (ver `AUTH.md`).
- Permite escalar `worker` de forma independiente.

### C. Servicios gestionados

Cada pieza en un servicio gestionado: la imagen del backend en una plataforma
de contenedores (un servicio para `api`, otro para `worker`), Postgres y Redis
gestionados, el `frontend` en un hosting de estáticos, y un almacenamiento de
objetos gestionado.

- Casi siempre frontend y API quedan en **dominios distintos** →
  `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true`, y `CORS_ORIGINS` con el dominio
  del frontend.
- Verificar que el plan del Postgres gestionado **no pause** la instancia por
  inactividad.

En las tres, los requisitos por componente y las variables de entorno son los
mismos — solo cambia *dónde* corre cada pieza.

---

## Checklist de despliegue

1. **Postgres** disponible y alcanzable; tener la `DATABASE_URL`.
2. **Redis** disponible y alcanzable; tener la `REDIS_URL`.
3. **Almacenamiento** decidido: `local` para un solo servidor, o un servicio
   S3-compatible con bucket y credenciales.
4. **Modelo FLAME** disponible en `FLAME_MODEL_PATH` (volumen o descarga).
5. **Construir** la imagen del backend desde `backend/Dockerfile`.
6. **Configurar** las variables de entorno del backend — generar un
   `JWT_SECRET_KEY` único, fijar `COOKIE_SECURE`/`COOKIE_SAMESITE` según la
   topología, y `CORS_ORIGINS` con el dominio real del frontend.
7. **Desplegar `api`** — al arrancar aplica `alembic upgrade head`.
8. **Desplegar `worker`** con la misma imagen y las mismas variables.
9. **Construir el frontend** con `VITE_API_URL`/`VITE_WS_URL` apuntando al
   `api` ya desplegado; publicar `dist/` con fallback SPA a `index.html`.
10. **Verificar:** `GET /health` responde; registro/login emiten cookie;
    crear un caso y correr el pipeline llega a "completed".

---

## Verificación post-despliegue

```bash
# 1. La API responde
curl https://<api>/health        # → {"status":"ok"}

# 2. Registro emite la cookie de sesión
curl -i -X POST https://<api>/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@ejemplo.tld","full_name":"Test","password":"password123"}'
# → 201 + cabecera Set-Cookie con HttpOnly (y Secure en prod)

# 3. El frontend carga y permite iniciar sesión sin errores de CORS
#    (revisar la consola del navegador: no debe haber errores cross-origin
#     ni cookie bloqueada).

# 4. Crear un caso, subir una malla y correr el pipeline.
#    El WebSocket debe mostrar el progreso de los 9 pasos hasta "completed".
```

Si la cookie no se guarda en el navegador: revisar `COOKIE_SAMESITE`/
`COOKIE_SECURE` y que `CORS_ORIGINS` liste el dominio exacto del frontend
(ver `AUTH.md`).
