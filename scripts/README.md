# Scripts

Utilidades de desarrollo para levantar, gestionar y depurar el stack local.

## Flujo típico

```bash
./scripts/setup.sh   # solo la primera vez
./scripts/start.sh   # cada vez que quieras trabajar
./scripts/stop.sh    # al terminar el día
```

---

## Referencia

### `setup.sh`

Primera configuración del entorno. Ejecutar una sola vez (o después de un `reset.sh`).

- Verifica que Docker y Docker Compose estén instalados
- Crea `backend/.env.local` y `frontend/.env.local` si no existen
- Construye todas las imágenes Docker
- Aplica las migraciones Alembic para inicializar el esquema de la DB

```bash
./scripts/setup.sh
```

> Si no tienes el modelo FLAME (`backend/assets/flame/generic_model.pkl`), el script lo avisa pero continúa. El stack levanta normalmente; solo fallarán los pasos 6–8 del pipeline.

---

### `start.sh`

Levanta todos los servicios en segundo plano y abre el navegador.

```bash
./scripts/start.sh
```

| URL | Servicio |
|---|---|
| `http://localhost:5173` | Frontend (Vite + HMR) |
| `http://localhost:8000` | API FastAPI |
| `http://localhost:8000/docs` | Swagger UI |
| `localhost:5432` | PostgreSQL (user: `dev` / pass: `dev`) |
| `localhost:6379` | Redis |

---

### `stop.sh`

Para todos los contenedores. Los volúmenes de datos (DB y Redis) se conservan.

```bash
./scripts/stop.sh
```

---

### `logs.sh`

Muestra logs en tiempo real.

```bash
./scripts/logs.sh             # todos los servicios
./scripts/logs.sh api         # solo la API FastAPI
./scripts/logs.sh worker      # solo el worker Celery
./scripts/logs.sh frontend    # solo el frontend Vite
./scripts/logs.sh postgres    # solo PostgreSQL
./scripts/logs.sh redis       # solo Redis
```

---

### `migrate.sh`

Gestión de migraciones Alembic. Si la API ya está corriendo, ejecuta dentro del contenedor; si no, levanta uno temporal.

```bash
./scripts/migrate.sh                          # aplica migraciones pendientes
./scripts/migrate.sh generate "add tabla X"  # genera una nueva migración
./scripts/migrate.sh status                  # muestra la migración actual
./scripts/migrate.sh history                 # historial completo
./scripts/migrate.sh downgrade               # revierte la última migración
```

> Después de `generate`, revisa el archivo creado en `backend/alembic/versions/` antes de aplicarlo.

---

### `shell.sh`

Abre una shell interactiva dentro de un contenedor en ejecución.

```bash
./scripts/shell.sh             # bash en el contenedor api (default)
./scripts/shell.sh worker      # bash en el contenedor worker
./scripts/shell.sh frontend    # bash en el contenedor frontend
./scripts/shell.sh postgres    # psql conectado a la DB local
./scripts/shell.sh redis       # redis-cli
```

---

### `rebuild.sh`

Reconstruye imágenes Docker sin bajar los volúmenes. Necesario al cambiar dependencias Python (`pyproject.toml`) o Node (`package.json`).

```bash
./scripts/rebuild.sh              # reconstruye api y worker (default)
./scripts/rebuild.sh frontend     # solo el frontend
./scripts/rebuild.sh api worker   # explícito
```

---

### `reset.sh`

Para el stack y **elimina** los volúmenes de datos (DB + Redis). Pide confirmación antes de proceder.

```bash
./scripts/reset.sh
```

Después de un reset, vuelve a ejecutar `setup.sh` para reinicializar.
