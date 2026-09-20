# craneofacial-pipeline

Pipeline de reconstrucción craneofacial 3D asistida por IA, construido con herramientas de código abierto. Desarrollado por el Semillero NeuroMinds, Universidad Externado de Colombia, en colaboración con la UBPD.

## Contexto rápido

Dado un cráneo digitalizado (.ply/.obj/.stl), el sistema produce una aproximación geométrica plausible del rostro, fundamentada en datos de grosor de tejido blando facial (FSTT) y deformación TPS. Los resultados son hipótesis visuales, no identificaciones positivas.

El flujo de trabajo es un pipeline de 9 pasos: ingestión de la malla, preprocesamiento geométrico, colocación manual de 21 landmarks, perfil biológico, alineación cráneo–cara, deformación TPS sobre el modelo FLAME y exportación del resultado. Cada caso forense pertenece a un usuario autenticado y solo es visible para su dueño.

## Estructura del repositorio

```
craneofacial-pipeline/
├── frontend/              # React + Vite + Three.js (SPA)
├── backend/               # FastAPI + Celery + Redis
├── docs/
│   ├── arquitecture/      # STACK, DB, AUTH, DEPLOY, DEPLOY_FREE
│   ├── pipeline/          # los 9 pasos técnicos (step1–step9)
│   ├── ui/                # especificaciones de UI por módulo
│   ├── docker/            # contenedores: local y producción
│   └── concepts/          # contexto conceptual del dominio
├── scripts/               # setup, start, stop, migrate, reset…
├── docker-compose.yml     # desarrollo local
├── Dockerfile             # imagen única para desplegar (api+worker+Redis+SPA)
└── AGENTS.md              # instrucciones para agentes de IA
```

## Arranque local

Requiere Docker (con Compose v2). El frontend se levanta como contenedor, no necesitas Node instalado.

```bash
git clone <repo>
cd craneofacial-pipeline

./scripts/setup.sh         # primera vez: build de imágenes + migraciones
./scripts/start.sh         # levanta api + worker + redis + postgres + frontend
```

- Frontend: <http://localhost:5173>
- API (docs OpenAPI): <http://localhost:8000/docs>

Otros scripts útiles en `scripts/` (ver `scripts/README.md`): `stop.sh`, `migrate.sh`, `reset.sh` (borra los datos locales), `logs.sh`, `shell.sh`.

## Autenticación

La app exige registro e inicio de sesión. Tras autenticarse, el usuario accede a sus
propios casos forenses. Detalle en `docs/arquitecture/AUTH.md`.

## Despliegue

### En un plan gratuito, con un solo servicio

El `Dockerfile` de la raíz empaqueta las seis piezas en una imagen: `api`,
`worker`, Redis, el SPA ya construido, SQLite y almacenamiento en disco. No
requiere ninguna variable de entorno para arrancar.

```bash
# Probarlo en local antes de subirlo (es la misma imagen)
docker compose -f docker-compose.demo.yml up --build   # → http://localhost:8000
```

En Render basta con **New → Blueprint** sobre el repo (`render.yaml` incluido);
en Hugging Face Spaces, Railway, Koyeb o Fly, apuntando al `Dockerfile` de la
raíz. Cada pieza interna se sustituye después por un servicio gestionado con
una variable (`DATABASE_URL`, `REDIS_URL`, `STORAGE_BACKEND=r2`) sin
reconstruir la imagen. Procedimiento, variables y límites:
`docs/arquitecture/DEPLOY_FREE.md`.

> Los datos son efímeros mientras no haya disco persistente o Postgres
> externo: es un entorno de demostración, no de trabajo forense.

### Por piezas separadas

La aplicación es agnóstica al proveedor — funciona igual en infraestructura
propia o en servicios gestionados. Los requisitos de cada componente (`api`,
`worker`, `frontend`, Postgres, Redis, almacenamiento de objetos) y el
procedimiento están en `docs/arquitecture/DEPLOY.md`.

## Documentación por tema

| Pregunta | Archivo |
|---|---|
| ¿Cómo funciona el pipeline técnico? | `docs/pipeline/` (step1–step9) |
| ¿Qué stack y por qué? | `docs/arquitecture/STACK.md` |
| ¿Cómo es la base de datos? | `docs/arquitecture/DB.md` |
| ¿Cómo funciona la autenticación? | `docs/arquitecture/AUTH.md` |
| ¿Cómo se despliega en producción? | `docs/arquitecture/DEPLOY.md` |
| ¿Cómo lo despliego gratis, de un tirón? | `docs/arquitecture/DEPLOY_FREE.md` |
| ¿Cómo debe verse la UI? | `docs/ui/` |
| ¿Cómo son los contenedores? | `docs/docker/` |
| ¿Cómo trabajar con agentes IA? | `AGENTS.md` |

## Referencias académicas clave

- Rhine & Campbell (1980) — protocolo de 21 landmarks FSTT
- Hona & Stephan (2024) — T-Table Global 2023, 220k mediciones
- Liang et al. (2024) — Skull-to-Face, IEEE TVCG
- Qiu et al. (2022) — SCULPTOR, ACM TOG
