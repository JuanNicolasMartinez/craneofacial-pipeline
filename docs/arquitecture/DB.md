# DB.md

Modelo de datos completo. Motor: PostgreSQL. ORM: SQLAlchemy 2.0 async. Migraciones: Alembic.

---

## Entornos

### Local — Docker Compose

Postgres corre en contenedor. Sin dependencias externas.

```yaml
# docker-compose.yml
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
```

```
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/craneofacial
```

### Producción

Postgres estándar — autoalojado o gestionado, indistinto. La aplicación solo
necesita una `DATABASE_URL` de Postgres alcanzable; SQLAlchemy conecta directo
con el driver async `asyncpg`. No se usa ninguna característica propietaria
(ni auth, ni realtime, ni cliente JS de proveedor alguno).

```
DATABASE_URL=postgresql+asyncpg://<usuario>:<password>@<host>:<puerto>/<db>
```

Consideraciones para producción:

- **Connection pooling:** si el proveedor o el despliegue ofrece un pooler
  (p. ej. PgBouncer), úsalo. El `api` y el `worker` abren conexiones por
  separado; sin pooler una DB pequeña puede agotar el límite de conexiones.
- **Disponibilidad:** la DB no debe pausarse por inactividad. Algunos planes
  gestionados suspenden la instancia tras días sin uso, lo que corta las
  conexiones de los workers Celery. Verifica este punto al elegir dónde correrla.

Detalle de despliegue en `docs/arquitecture/DEPLOY.md`.

---

## ORM — SQLAlchemy 2.0 async

### Configuración del engine

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    echo=False,          # True solo en desarrollo para ver SQL
)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db():
    async with SessionLocal() as session:
        yield session
```

### Ejemplo de modelo

```python
# backend/app/models/case.py
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Text, func
import uuid

class Base(DeclarativeBase):
    pass

class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    case_ref: Mapped[str] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="created")
    notes: Mapped[str | None] = mapped_column(Text)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

### Migraciones con Alembic

```bash
# Crear migración desde cambios en modelos
alembic revision --autogenerate -m "add reconstructions table"

# Aplicar migraciones pendientes
alembic upgrade head

# Revertir última migración
alembic downgrade -1
```

Regla: nunca usar `Base.metadata.create_all()` en producción. Solo Alembic.

---

## Diagrama de entidades

```
User ──── Case                 (1:N, cada caso pertenece a un usuario)
Case ──── Mesh                 (1:1 activo, 1:N histórico)
Case ──── BiologicalProfile    (1:1)
Case ──── LandmarkSet          (1:N, un set por operador)
Case ──── PipelineJob          (1:N, una ejecución por run)
LandmarkSet ──── Landmark      (1:21)
PipelineJob ──── JobStep       (1:9)
PipelineJob ──── Reconstruction (1:N, una por variante k)
```

---

## Tablas

### `users`
Cuenta de usuario. Cada caso pertenece a un usuario (ver `docs/arquitecture/AUTH.md`).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | generado en DB |
| `email` | VARCHAR(255) | UNIQUE, indexado — identidad de login |
| `full_name` | VARCHAR(100) | nombre mostrado del usuario |
| `hashed_password` | VARCHAR(255) | hash bcrypt — nunca se expone por la API |
| `is_active` | BOOLEAN | default true; un usuario inactivo no puede autenticarse |
| `created_at` | TIMESTAMPTZ | default now() |

---

### `cases`
Entidad central. Representa un caso forense.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | generado en DB |
| `case_ref` | VARCHAR(100) | referencia humana, ej. "CASO-2025-084" |
| `status` | VARCHAR(20) | `created` `landmarks_ready` `running` `completed` `error` |
| `notes` | TEXT | nullable |
| `user_id` | UUID FK → users | dueño del caso; NOT NULL, indexado |
| `created_at` | TIMESTAMPTZ | default now() |
| `updated_at` | TIMESTAMPTZ | auto-update |

> El antiguo campo `created_by` (VARCHAR libre) fue reemplazado por `user_id`. El nombre del operador se obtiene vía la relación `Case.user.full_name`.

---

### `meshes`
Malla 3D del cráneo asociada al caso.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `case_id` | UUID FK → cases | |
| `r2_key` | VARCHAR(500) | key del objeto en el almacenamiento S3-compatible |
| `format` | VARCHAR(10) | `ply` `obj` `stl` |
| `status` | VARCHAR(20) | `uploaded` `preprocessed` `error` |
| `vertex_count` | INTEGER | nullable, poblado en paso 2 |
| `file_size_bytes` | BIGINT | |
| `created_at` | TIMESTAMPTZ | |

---

### `biological_profiles`
Perfil estimado del individuo. Determina qué tabla FSTT se aplica.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `case_id` | UUID FK → cases | UNIQUE (1:1 con caso) |
| `sex` | VARCHAR(1) | `M` `F` |
| `ancestry` | VARCHAR(30) | `global` `latinoamerican` `turkish` `korean` `caucasian` |
| `age_range` | VARCHAR(10) | `18-35` `35-50` `50+` `unknown` |
| `confidence` | FLOAT | 0.0–1.0, documentado por operador |
| `fstt_table` | VARCHAR(50) | tabla seleccionada por el sistema, ej. `T-Table-Global-2023` |
| `created_at` | TIMESTAMPTZ | |

---

### `landmark_sets`
Agrupador de los 21 landmarks de una sesión de marcado.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `case_id` | UUID FK → cases | |
| `protocol` | VARCHAR(30) | `Rhine-Campbell-1980` (único soportado hoy) |
| `operator` | VARCHAR(100) | quién colocó los landmarks |
| `mean_inter_operator_dist_mm` | FLOAT | nullable, para control de calidad |
| `created_at` | TIMESTAMPTZ | |

---

### `landmarks`
Un punto anatómico individual. Siempre 21 por `landmark_set`.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `set_id` | UUID FK → landmark_sets | |
| `label` | VARCHAR(50) | nombre del landmark, ej. `nasion` |
| `x` | FLOAT | coordenada 3D sobre la malla |
| `y` | FLOAT | |
| `z` | FLOAT | |
| `nx` | FLOAT | normal unitaria en ese punto |
| `ny` | FLOAT | |
| `nz` | FLOAT | |

Labels válidos: ver `frontend/src/features/landmarks/constants.ts` y `docs/pipeline/step3.md`.

---

### `pipeline_jobs`
Una ejecución del pipeline. Un caso puede tener múltiples jobs (re-ejecuciones, variantes).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | también es el `job_id` del WebSocket |
| `case_id` | UUID FK → cases | |
| `landmark_set_id` | UUID FK → landmark_sets | snapshot usado en este job |
| `celery_task_id` | VARCHAR(100) | para introspección de Celery |
| `status` | VARCHAR(20) | `pending` `running` `completed` `error` |
| `fstt_table` | VARCHAR(50) | tabla FSTT usada |
| `fstt_k_factor` | FLOAT | 0.0 = media, ±N = variante |
| `error_message` | TEXT | nullable, si status='error' |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | nullable |

---

### `job_steps`
Estado individual de cada uno de los 9 pasos del pipeline.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `job_id` | UUID FK → pipeline_jobs | |
| `step_number` | INTEGER | 1–9 |
| `name` | VARCHAR(50) | ej. `preprocessing` `tps_deformation` |
| `status` | VARCHAR(20) | `pending` `running` `done` `error` |
| `params` | JSONB | parámetros usados en este paso (trazabilidad) |
| `duration_ms` | INTEGER | nullable |
| `completed_at` | TIMESTAMPTZ | nullable |

---

### `reconstructions`
Resultado final de un job. Puede haber varias por job (una por variante k).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID PK | |
| `job_id` | UUID FK → pipeline_jobs | |
| `r2_key_mesh` | VARCHAR(500) | key del objeto `resultado.ply` en el almacenamiento |
| `r2_key_params` | VARCHAR(500) | key del objeto `params.json` en el almacenamiento |
| `p2p_error_mm` | FLOAT | nullable, si hay cara de referencia |
| `hausdorff_mm` | FLOAT | nullable |
| `created_at` | TIMESTAMPTZ | |

---

## Índices recomendados

```sql
CREATE UNIQUE INDEX ix_users_email ON users(email);
CREATE INDEX ix_cases_user_id ON cases(user_id);
CREATE INDEX idx_meshes_case_id ON meshes(case_id);
CREATE INDEX idx_landmark_sets_case_id ON landmark_sets(case_id);
CREATE INDEX idx_landmarks_set_id ON landmarks(set_id);
CREATE INDEX idx_pipeline_jobs_case_id ON pipeline_jobs(case_id);
CREATE INDEX idx_pipeline_jobs_status ON pipeline_jobs(status);
CREATE INDEX idx_job_steps_job_id ON job_steps(job_id);
CREATE INDEX idx_reconstructions_job_id ON reconstructions(job_id);
```

---

## Convenciones

- Todos los IDs son UUID generados por la base de datos (`gen_random_uuid()`)
- Timestamps siempre con timezone (`TIMESTAMPTZ`)
- Campos `status` son VARCHAR con valores controlados — no enums de Postgres (más fácil de migrar)
- JSONB en `job_steps.params` para flexibilidad de parámetros por paso sin schema fijo
- Archivos binarios (mallas) nunca en la DB — solo la key del objeto en el almacenamiento
- Migraciones: `alembic revision --autogenerate -m "descripción"` → revisar antes de aplicar