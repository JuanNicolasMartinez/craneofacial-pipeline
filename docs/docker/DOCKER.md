# Docker

Documentación de contenedores para desarrollo local y producción.

## Archivos en este directorio

| Archivo | Qué describe |
|---|---|
| `LOCAL.md` | Entorno de desarrollo con `docker compose up` |
| `SERVICES.md` | Qué hace cada servicio, sus puertos y dependencias |
| `PROD.md` | Imágenes para deploy en Railway / Render |

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
| `redis` | `redis:7-alpine` | `6379` | local + prod (Railway) |
| `frontend` | `frontend/Dockerfile` | `5173` | solo local (Vite dev server) |

En producción, Postgres lo provee Supabase y Redis lo provee Railway Redis — no se containeriza.

Todo muy optimizado.