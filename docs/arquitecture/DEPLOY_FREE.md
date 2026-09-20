# DEPLOY_FREE.md

Despliegue de la aplicación completa en un **plan gratuito o de prueba**, con
un solo servicio y sin infraestructura externa.

`DEPLOY.md` describe el despliegue por piezas (`api`, `worker`, `frontend`,
Postgres, Redis, almacenamiento) y sigue siendo la referencia para producción.
Este documento describe un **artefacto adicional**, no un reemplazo: la misma
aplicación empaquetada en una sola imagen para plataformas donde solo cabe un
contenedor con un puerto.

---

## Qué es el contenedor todo-en-uno

`Dockerfile` (en la raíz del repo) produce una imagen que contiene las seis
piezas del sistema:

| Pieza | Dónde vive en la imagen |
|---|---|
| `api` | `uvicorn` escuchando en `$PORT` |
| `worker` | proceso Celery atendiendo las tres colas |
| `frontend` | build estático servido por el propio `api` |
| Base de datos | SQLite en `DATA_DIR` |
| Redis | `redis-server` local en `127.0.0.1:6379` |
| Almacenamiento | disco, en `DATA_DIR/storage`, servido vía `/files/...` |

```
          ┌──────────────── contenedor único ────────────────┐
          │                                                  │
 navegador┼─▶ :$PORT  uvicorn ──┬─▶ SPA estático (dist/)      │
          │                     ├─▶ API REST + WebSocket      │
          │                     └─▶ /files/... (resultados)   │
          │                          │            ▲           │
          │                     SQLite + disco    │           │
          │                          ▲            │           │
          │                  Redis local ◀── worker Celery    │
          └──────────────────────────────────────────────────┘
```

Como el SPA se sirve desde el mismo origen que la API, no hay CORS que
configurar ni cookie cross-site: `COOKIE_SAMESITE=lax` basta.

**Cada pieza interna se sustituye por un servicio externo con una variable de
entorno**, sin reconstruir la imagen: define `DATABASE_URL` y usa Postgres,
define `REDIS_URL` y usa Redis gestionado, define `STORAGE_BACKEND=r2` y usa
almacenamiento S3. El mismo artefacto sirve para la demo de un clic y para un
despliegue con datos persistentes.

---

## Arranque en local

```bash
docker compose -f docker-compose.demo.yml up --build   # → http://localhost:8000
```

Es exactamente la imagen que se sube a la nube. Para desarrollo diario sigue
usando `docker-compose.yml` (hot-reload separado de frontend y backend).

---

## Despliegue por plataforma

Todas las plataformas parten del mismo repo y del `Dockerfile` de la raíz.
Ninguna necesita variables obligatorias para arrancar.

### Render (plan free) — la opción probada

El repo incluye `render.yaml`, así que el despliegue es un blueprint:

1. Sube el repo a GitHub.
2. Render → **New → Blueprint** → selecciona el repo.
3. Render construye la imagen, inyecta `$PORT` y genera `JWT_SECRET_KEY`.

El plan free duerme el servicio tras 15 minutos de inactividad (el primer
acceso después tarda ~1 min) y no tiene disco persistente: cada reinicio parte
de una base vacía.

Sus 512 MB de RAM dan de sobra para el pipeline completo. Medido sobre la
imagen, con el contenedor limitado a 512 MB:

| Situación | Memoria |
|---|---|
| En reposo (api + worker + Redis) | 181 MiB |
| Reconstrucción de una malla de 41k vértices | 327 MiB de pico |
| Reconstrucción de una malla de 164k vértices | 401 MiB de pico |

Ambas reconstrucciones terminaron en `completed` sin que el kernel matara el
proceso. Para mallas notablemente más densas conviene medir antes, o decimar
el cráneo en el paso 2.

### Hugging Face Spaces (requiere PRO)

Hardware holgado (2 vCPU / 16 GB), pero **ya no sirve como plan gratuito**:
desde 2026, alojar un Space de tipo Docker en `cpu-basic` exige suscripción
PRO. La API responde `402 Payment Required` al crear el Space sin ella.
Comprobado el 2026-09-20. Con PRO, el procedimiento es:

1. Crea un Space con SDK **Docker**. Si vas a incluir el modelo FLAME, que
   sea **privado**: su licencia no permite redistribuirlo.
2. Sube el contenido del repo. El `README.md` del Space necesita esta cabecera
   de metadatos (solo vive en el Space, no en el repo de GitHub):

```yaml
---
title: Craneofacial Pipeline
sdk: docker
app_port: 7860
pinned: false
---
```

Y añade la variable `PORT=7860` para que el contenedor y el proxy del Space
coincidan.

3. En **Settings → Variables and secrets**: `DATA_DIR=/tmp/data` como variable
   (sin disco de pago, `/data` no es escribible) y `JWT_SECRET_KEY` como
   *secret*.
4. Opcional: sube `generic_model.pkl` a `deploy/flame/` del Space para que el
   paso 9 funcione.

### Railway / Koyeb / Fly.io

Despliegue desde el repo detectando el `Dockerfile` de la raíz. Solo hay que
asegurar que el contenedor escuche en el puerto que inyecta la plataforma:
Railway y Koyeb definen `$PORT` (el entrypoint ya lo respeta); en Fly, fija
`internal_port = 8000` en `fly.toml`.

Conviene definir siempre `JWT_SECRET_KEY` (`openssl rand -hex 32`) para que
los reinicios no cierren las sesiones abiertas.

---

## Variables de entorno

Ninguna es obligatoria. `.env.example` en la raíz las lista todas.

| Variable | Por defecto | Para qué |
|---|---|---|
| `PORT` | `8000` | Puerto HTTP. Las plataformas suelen inyectarlo. |
| `DATA_DIR` | `/data` | SQLite, archivos subidos y secreto JWT. Usar `/tmp/data` donde el resto del disco sea de solo lectura. |
| `JWT_SECRET_KEY` | se genera y se guarda en `DATA_DIR` | Firma de la sesión. Definirla evita cerrar sesiones al reiniciar. |
| `COOKIE_SECURE` | `false` | `true` en cualquier despliegue con HTTPS. |
| `COOKIE_SAMESITE` | `lax` | Correcto mientras SPA y API compartan dominio. |
| `DATABASE_URL` | SQLite en `DATA_DIR` | Postgres externo. Acepta `postgres://…` y `?sslmode=require` tal como los publica el proveedor. |
| `REDIS_URL` | Redis local del contenedor | Redis externo. |
| `STORAGE_BACKEND` | `local` | `r2` para almacenamiento S3-compatible (ver `DEPLOY.md`). |
| `PUBLIC_BASE_URL` | vacío | Vacío = URLs de archivos relativas, que es lo correcto aquí. |
| `FLAME_MODEL_URL` | — | Si está, el entrypoint descarga el `.pkl` en el arranque. |
| `FLAME_MODEL_AUTH_HEADER` | — | Cabecera de autenticación para esa descarga, si la URL es privada. |
| `FLAME_MODEL_PATH` | `/data/flame/generic_model.pkl` | Dónde espera el worker el modelo. |
| `CELERY_CONCURRENCY` | `1` | Procesos del worker. Subirlo solo con memoria de sobra. |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Solo si sirves el SPA desde otro dominio. Acepta lista JSON o `a,b`. |

---

## El modelo FLAME

`generic_model.pkl` (~53 MB) no está en el repo ni en la imagen: requiere
registro en <https://flame.is.tue.mpg.de>. Sin él, los pasos 1–8 corren y el
paso 9 falla con un error explícito; el resto de la app funciona.

Tres formas de proveerlo, en el orden en que las busca el entrypoint:

1. **Volumen montado** en `FLAME_MODEL_PATH` (por defecto `/data/flame/`). Es
   lo que hace `docker-compose.demo.yml` con tu copia local.
2. **Horneado en la imagen**: copia el `.pkl` a `deploy/flame/` antes de
   construir y viajará dentro. Única vía cuando la plataforma no tiene disco
   persistente *ni* permite descargarlo (un Space privado, por ejemplo). El
   `.pkl` está en `.gitignore`: su licencia no permite redistribuirlo, así que
   nunca en un repositorio público.
3. **Descarga en el arranque** con `FLAME_MODEL_URL`. Como la URL casi
   siempre será privada —un dataset privado del Hub, un bucket, un release
   privado—, `FLAME_MODEL_AUTH_HEADER` añade la cabecera de autenticación:

   ```
   FLAME_MODEL_URL=https://huggingface.co/datasets/<tu-usuario>/<repo>/resolve/main/generic_model.pkl
   FLAME_MODEL_AUTH_HEADER=Authorization: Bearer hf_xxx
   ```

   Es la vía para Render y similares, donde el repo de GitHub no lleva el
   `.pkl`.

---

## Límites de este modo

Lo que se gana en simplicidad se paga aquí; conviene tenerlo presente antes de
enseñar la app a alguien:

- **Datos efímeros.** Sin disco persistente, cada reinicio borra usuarios,
  casos y resultados. Es un entorno de demostración, no de trabajo forense.
- **Un solo proceso de worker.** Los jobs se encolan y corren de a uno.
- **SQLite.** Va sobrado para uno o dos usuarios simultáneos; no para un
  equipo trabajando a la vez sobre la misma instancia.
- **Memoria.** La reconstrucción carga la malla y el modelo FLAME. En 512 MB
  cabe holgadamente hasta ~164k vértices (401 MiB de pico medidos); mallas
  mucho más densas piden más instancia.
- **Suspensión por inactividad.** En planes free que duermen el servicio, un
  job en curso se pierde al suspenderse.

Para quitar cada límite sin cambiar de artefacto: `DATABASE_URL` a un Postgres
gestionado, `STORAGE_BACKEND=r2` con un bucket, y `REDIS_URL` a un Redis
gestionado. A partir de ahí el despliegue ya es el de `DEPLOY.md`, solo que
con `api` y `worker` compartiendo contenedor.

---

## Verificación post-despliegue

```bash
# 1. La API responde
curl https://<dominio>/health            # → {"status":"ok"}

# 2. El SPA se sirve y las rutas profundas no dan 404
curl -o /dev/null -w '%{http_code}\n' https://<dominio>/app/casos   # → 200

# 3. El registro emite la cookie de sesión
curl -i -X POST https://<dominio>/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@ejemplo.tld","full_name":"Test","password":"password123"}'
# → 201 + Set-Cookie ... HttpOnly
```

Luego, desde el navegador: crear un caso, subir una malla, colocar los 21
landmarks y correr el pipeline. El WebSocket debe mostrar el avance de los 9
pasos hasta `completed` (o hasta el error del paso 9 si no hay modelo FLAME).
