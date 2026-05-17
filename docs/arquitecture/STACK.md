# STACK.md

Stack tecnológico completo. Cada decisión incluye su justificación y lo que reemplaza.

---

## Visión general

```
Browser          → React + Three.js (Vite)
HTTP / WS        → REST + WebSocket
API              → FastAPI (Python 3.11+)
Job queue        → Celery + Redis
Pipeline compute → PyMeshLab · NumPy/SVD · SciPy · FLAME · trimesh
Database         → PostgreSQL
Object storage   → almacenamiento de objetos compatible con S3
```

El stack no depende de ningún proveedor concreto. Cada pieza
(API, worker, Redis, Postgres, almacenamiento, frontend estático) se puede
desplegar en infraestructura propia o gestionada. Requisitos de despliegue
en `docs/arquitecture/DEPLOY.md`.

---

## Frontend

### React 18 + Vite
**Por qué:** ecosistema maduro, soporte nativo para React Three Fiber, HMR rápido con Vite. Next.js descartado — no hay SSR necesario, el app es 100% cliente autenticado.

### React Three Fiber + @react-three/drei
**Por qué:** wrapper idiomático de Three.js para React. `drei` provee `<OrbitControls>`, `<TransformControls>`, loaders PLY/OBJ listos. Alternativas (Babylon.js, CesiumJS) descartadas por overhead y falta de primitivas forenses.

### TanStack Query v5
**Por qué:** maneja cache, refetch, loading/error states del servidor. Reemplaza useState+useEffect para datos remotos. Estado del servidor nunca va a Zustand.

### Zustand
**Por qué:** estado local de UI (job activo, paso del pipeline, landmarks en construcción). Más simple que Redux para este scope. No persiste en localStorage.

### shadcn/ui + Tailwind CSS
**Por qué:** componentes accesibles sin runtime CSS-in-JS. shadcn copia el código al repo (no dependencia externa), permite modificar libremente.

### openapi-typescript
**Por qué:** genera tipos TypeScript desde el schema OpenAPI de FastAPI. Elimina tipos de API escritos a mano. Corre con `pnpm generate-types`.

---

## Backend

### FastAPI (Python 3.11+)
**Por qué:** async nativo, validación automática con Pydantic, OpenAPI generado sin configuración, soporte WebSocket built-in. Flask descartado por falta de async y validación. Django descartado por overhead.

### Pydantic v2
**Por qué:** validación de I/O en todos los endpoints. Los schemas en `app/schemas/` son la única fuente de verdad de los contratos de API.

### SQLAlchemy 2.0 (async) + Alembic
**Por qué:** ORM con soporte async para FastAPI. Alembic para migraciones versionadas. Nunca usar `create_all()` en producción.

### Celery + Redis
**Por qué:** el pipeline tarda 30–120 s. BackgroundTasks de FastAPI no tiene reintentos, visibilidad de estado ni colas separadas por tipo de worker. Redis sirve como broker y como canal de publicación para WebSocket.

**Colas separadas:**
```
mesh_queue    → mesh_worker (PyMeshLab, intensivo en I/O)
compute_queue → align_worker + tps_worker (intensivo en CPU)
export_queue  → export_worker (I/O liviano)
```

### PyMeshLab
**Por qué:** API Python oficial de MeshLab. Reemplaza llamar al ejecutable MeshLab vía subprocess. Mismas operaciones, integrable en el worker sin UI.

### NumPy linear algebra (SVD / Procrustes)
**Por qué:** la alineación cráneo–cara se resuelve con un similarity transform analítico sobre 21 correspondencias anatómicas. Es más simple y estable que introducir un stack de registro 3D adicional para esta etapa.

### SciPy (RBFInterpolator)
**Por qué:** implementación robusta de Thin Plate Splines. `kernel='thin_plate_spline'` en `RBFInterpolator` es exactamente la función φ(r) = r² log(r) necesaria.

### FLAME
**Por qué:** único modelo paramétrico facial 3D open-source con topología consistente y landmarks predefinidos compatibles con Rhine & Campbell. En Forense v1 se usa como prior anatómico conservador: mantiene forma humana mientras FSTT y landmarks actúan como restricciones suaves. No infiere identidad desde el cráneo. Requiere registro en flame.is.tue.mpg.de (gratuito, académico). El `.pkl` (~140 MB) no se commitea al repo.

### trimesh
**Por qué:** exportación limpia a `.ply`/`.obj` con metadatos y una API simple para la etapa final del pipeline.

---

## Autenticación

Auth básica con registro y login propio. Sin inicio de sesión con redes sociales. Detalle completo en `docs/arquitecture/AUTH.md`.

### passlib (bcrypt)
**Por qué:** hashing estándar de contraseñas. bcrypt incorpora salt y un factor de coste ajustable. Nunca se almacena ni se loguea la contraseña en claro.

### python-jose
**Por qué:** firma y verificación de JWT (HS256). El token lleva el `id` del usuario y una expiración. La autenticación es propia de la aplicación — Postgres se consume solo como servidor SQL estándar (ver `DB.md`).

### Cookie HttpOnly como transporte de sesión
**Por qué:** el JWT viaja en una cookie `HttpOnly` + `SameSite=Lax`, no en `localStorage`. JavaScript no puede leer la cookie, lo que la hace inmune al robo de token por XSS. El navegador la adjunta automáticamente; axios solo necesita `withCredentials: true`. El CORS del backend ya tiene `allow_credentials=True`.

---

## Comunicación Frontend–Backend

### REST (HTTP)
Usado para todas las operaciones con estado bien definido: crear caso, subir malla, guardar landmarks, perfil biológico, descargar resultado.

Convención de endpoints:
```
POST   /auth/register                  crear cuenta → cookie de sesión
POST   /auth/login                     iniciar sesión → cookie de sesión
POST   /auth/logout                    cerrar sesión (borra la cookie)
GET    /auth/me                        usuario autenticado actual
POST   /cases                          crear caso
POST   /cases/{id}/mesh                subir cráneo
PATCH  /cases/{id}/landmarks           guardar 21 landmarks
PATCH  /cases/{id}/biological-profile  perfil biológico
POST   /cases/{id}/pipeline/run        iniciar pipeline → 202 + job_id
GET    /cases/{id}/result              URLs firmadas del resultado
GET    /cases                          listar casos del usuario
```

Todos los endpoints de `/cases` requieren sesión y solo operan sobre casos del usuario autenticado (aislamiento estricto; ver `AUTH.md`).

### WebSocket
Usado exclusivamente para progreso del pipeline en tiempo real.

```
WS /ws/jobs/{job_id}
```

Flujo: worker publica en Redis → FastAPI lee y hace push al cliente. El cliente no hace polling.

### GraphQL — descartado
El dominio es lineal y los endpoints son predecibles. GraphQL agregaría schema, resolvers y DataLoader sin beneficio real para este scope.

---

## Infraestructura

La aplicación es agnóstica al proveedor. Cada componente se define por su
contrato, no por dónde corre. La guía completa de despliegue —
infraestructura propia o gestionada — está en `docs/arquitecture/DEPLOY.md`.

### Almacenamiento de objetos (compatible con S3)
**Por qué:** las mallas (5–20 MB c/u) no se guardan en la DB ni pasan por el
servidor FastAPI — se acceden vía URLs firmadas. El backend usa la API S3
(`boto3`), por lo que sirve cualquier almacenamiento compatible con S3, ya sea
autoalojado o gestionado. En desarrollo se usa el backend `local`
(`STORAGE_BACKEND=local`), que guarda en disco.

### PostgreSQL
**Por qué:** base de datos relacional. Se consume como servidor Postgres
estándar vía SQLAlchemy async — sin extensiones ni servicios propietarios.
Funciona igual autoalojado o gestionado. Ver `DB.md` para el esquema.

### Redis
**Por qué:** broker de Celery y canal pub/sub para el WebSocket. Cualquier
Redis ≥ 7 sirve, autoalojado o gestionado.

### Frontend estático
**Por qué:** Vite produce un build estático (`dist/`) que sirve cualquier
servidor web o CDN. No requiere runtime de Node en producción.

---

## Archivos de configuración críticos

```
backend/app/core/config.py      → settings via pydantic-settings (env vars)
backend/app/core/fstt.py        → tabla FSTT estática, fuente académica citada
backend/app/core/reconstruction.py → carga del template FLAME + warp Procrustes/TPS
backend/app/core/flame_landmarks.py → mapping canónico de 21 landmarks FLAME
docker-compose.yml              → api + worker + redis + postgres local
frontend/.env.local             → VITE_API_URL, VITE_WS_URL
```
