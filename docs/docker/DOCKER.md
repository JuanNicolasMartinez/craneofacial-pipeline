# Docker

Documentación de contenedores para desarrollo local y producción.

## Archivos en este directorio

| Archivo | Qué describe |
|---|---|
| `LOCAL.md` | Entorno de desarrollo con `docker compose up` |
| `SERVICES.md` | Qué hace cada servicio, sus puertos y dependencias |
| `PROD.md` | Imágenes y configuración para el despliegue en producción |

Los requisitos de despliegue, independientes del proveedor, están en
`docs/arquitecture/DEPLOY.md`.

## Estructura de archivos Docker en el repo

```
craneofacial-pipeline/
├── docker-compose.yml          ← desarrollo local (todos los servicios)
├── docker-compose.prod.yml     ← overrides para producción
├── backend/
│   ├── Dockerfile              ← imagen compartida api + worker
│   └── .dockerignore
└── frontend/
    ├── Dockerfile              ← build estático para preview local
    └── .dockerignore
```

## Resumen de servicios

| Servicio | Imagen | Puerto local | Usado en |
|---|---|---|---|
| `api` | `backend/Dockerfile` | `8000` | local + prod |
| `worker` | `backend/Dockerfile` | — | local + prod |
| `postgres` | `postgres:16-alpine` | `5432` | solo local |
| `redis` | `redis:7-alpine` | `6379` | local + prod |
| `frontend` | `frontend/Dockerfile` | `5173` | solo local (Vite dev server) |

En producción, Postgres y Redis pueden correr como contenedores propios o como
servicios gestionados — la aplicación solo necesita una `DATABASE_URL` y una
`REDIS_URL` alcanzables. El frontend en producción es un build estático, no un
contenedor. Ver `docs/arquitecture/DEPLOY.md`.