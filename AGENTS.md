# AGENTS.md

Instrucciones para agentes de IA (Claude Code, Cursor, Copilot, etc.) trabajando en este repositorio.

## Lee esto primero, no el código

Antes de tocar cualquier archivo, lee en orden:
1. `docs/arquitecture/STACK.md` — qué tecnologías existen y por qué
2. `docs/arquitecture/DB.md` — modelo de datos completo
3. `docs/arquitecture/AUTH.md` — autenticación y propiedad de casos
4. `docs/arquitecture/DEPLOY.md` — requisitos de despliegue (agnóstico al proveedor)
5. `docs/pipeline/step1.md` — los 9 pasos del pipeline y sus dependencias
6. `docs/ui/` — especificaciones de UI del módulo en el que vas a trabajar
7. `docs/docker/` — especificaciones de de los contenedores

## Mapa de responsabilidades

```
frontend/src/pages/                → páginas de routing (landing, login, registro, perfil)
frontend/src/features/viewer3d/    → Three.js, carga y visualización de mallas
frontend/src/features/landmarks/   → selección interactiva de 21 puntos
frontend/src/features/pipeline/    → control de pasos + WebSocket hook
frontend/src/features/cases/       → CRUD de casos forenses
frontend/src/api/                  → cliente axios + hooks TanStack Query
frontend/src/store/                → Zustand: estado local (jobStore, authStore)

backend/app/api/routes/            → endpoints REST (FastAPI routers)
backend/app/api/deps.py            → dependencias compartidas (get_current_user)
backend/app/api/websockets.py      → WS /ws/jobs/{job_id}
backend/app/services/              → lógica de negocio, sin I/O directo
backend/app/workers/               → Celery tasks, una por grupo de pasos
backend/app/models/                → SQLAlchemy ORM
backend/app/schemas/               → Pydantic I/O (validación + docs)
backend/app/core/security.py       → hashing de contraseñas + JWT
backend/app/core/fstt.py           → tabla FSTT estática, nunca se modifica en runtime
```

## Reglas invariables

**Backend**
- Nunca pongas lógica de negocio en los routers — va en `services/`
- Los workers (`workers/`) solo orquestan: llaman servicios, publican en Redis, no acceden a DB directamente
- `fstt.py` es un diccionario estático cargado en startup — no hay base de datos de FSTT
- Todo schema de entrada/salida tiene su clase Pydantic en `schemas/` — nunca uses `dict` crudo en routers
- Migraciones solo con Alembic — nunca `Base.metadata.create_all()` en producción
- Todo endpoint que toca un caso usa `Depends(get_current_user)` y filtra por `user_id` — un caso ajeno responde `404`. Ver `docs/arquitecture/AUTH.md`
- La contraseña nunca se almacena ni se loguea en claro; el token JWT nunca se expone fuera de la cookie HttpOnly

**Frontend**
- El estado de auth vive en `store/authStore.ts` (cache del `User`); la sesión real está en la cookie HttpOnly, nunca en `localStorage`
- Las rutas bajo `/app` van envueltas en `ProtectedRoute` — no añadas vistas autenticadas fuera de ese árbol

**Frontend**
- Estado del servidor → TanStack Query. Estado de UI local → Zustand. No mezclar
- El viewer 3D (Three.js) vive en `features/viewer3d/` — no importes Three directamente fuera de esa carpeta
- Los 21 landmarks del protocolo Rhine & Campbell están hardcodeados en `features/landmarks/constants.ts` — no se calculan
- WebSocket solo en `features/pipeline/useJobSocket.ts` — no abras conexiones WS en otro lugar

**General**
- Convención de commits: `feat(frontend):`, `feat(backend):`, `fix(worker):`, `docs:`
- Un PR = un cambio cohesivo. No mezcles refactor con features
- Los archivos en `docs/` describen intención — si cambias comportamiento, actualiza el doc correspondiente

## Contratos entre frontend y backend

El contrato canónico es el schema OpenAPI generado por FastAPI en `/docs` (dev) o `/openapi.json`. Si hay discrepancia entre ese schema y cualquier otro archivo, el schema de FastAPI gana.

Los tipos TypeScript del cliente se generan desde ese schema:
```bash
cd frontend && pnpm generate-types      # usa openapi-typescript
```

No escribas tipos de API a mano.

## Qué NO hacer

- No instales librerías 3D alternativas a Three.js (babylon.js, potree, etc.) sin discutirlo
- No reemplaces Celery por BackgroundTasks de FastAPI — los workers necesitan reintentos y colas separadas
- No accedas al almacenamiento de objetos desde el frontend directamente, excepto para descargar URLs firmadas generadas por el backend
- No añadas lógica de identificación biométrica — el sistema produce hipótesis visuales, no identidades
- No modifiques `backend/app/core/fstt.py` con datos inventados — toda actualización de la tabla requiere fuente académica citada

## Contexto del dominio (léelo una vez)

- **Landmark**: punto anatómico sobre el cráneo con coordenadas (x,y,z) y normal (nx,ny,nz)
- **FSTT**: grosor de tejido blando en mm entre cráneo y cara en ese landmark
- **Punto de control facial**: `p_craneal + d_i * normal` donde `d_i` viene de la T-Table
- **TPS**: Thin Plate Splines — interpolación que deforma la malla FLAME para que sus landmarks coincidan con los puntos de control
- **FLAME**: modelo facial paramétrico neutro usado solo como malla base, nunca infiere del cráneo
- **Job**: ejecución del pipeline completo, rastreada en DB y notificada por WebSocket
- **Usuario**: cuenta autenticada (email + contraseña). Cada caso pertenece a un usuario y solo es visible para su dueño
