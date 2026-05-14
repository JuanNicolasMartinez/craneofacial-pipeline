# craneofacial-pipeline

Pipeline de reconstrucción craneofacial 3D asistida por IA, construido con herramientas de código abierto. Desarrollado por el Semillero NeuroMinds, Universidad Externado de Colombia, en colaboración con la UBPD.

## Contexto rápido

Dado un cráneo digitalizado (.ply/.obj/.stl), el sistema produce una aproximación geométrica plausible del rostro, fundamentada en datos de grosor de tejido blando facial (FSTT) y deformación TPS. Los resultados son hipótesis visuales, no identificaciones positivas.

## Estructura del repositorio

```
craneofacial-pipeline/
├── frontend/              # React + Vite + Three.js
├── backend/               # FastAPI + Celery + Redis
├── docs/
│   ├── pipeline/
│   │   └── step1.md       # Pipeline completo: 9 pasos técnicos
│   ├── architecture/
│   │   ├── STACK.md       # Stack tecnológico y justificaciones
│   │   └── DB.md          # Modelo de datos y esquema Postgres
│   └── ui/                # Especificaciones de UI por módulo
├── docker-compose.yml
└── AGENTS.md              # Instrucciones para agentes de IA
```

## Arranque local

```bash
git clone <repo>
cd craneofacial-pipeline
docker compose up          # levanta api + worker + redis + postgres
# frontend en /frontend: pnpm install && pnpm dev
```

## Documentación por tema

| Pregunta | Archivo |
|---|---|
| ¿Cómo funciona el pipeline técnico? | `docs/pipeline/step1.md` |
| ¿Qué stack y por qué? | `docs/architecture/STACK.md` |
| ¿Cómo es la base de datos? | `docs/architecture/DB.md` |
| ¿Cómo debe verse la UI? | `docs/ui/` |
| ¿Cómo trabajar con agentes IA? | `AGENTS.md` |

## Referencias académicas clave

- Rhine & Campbell (1980) — protocolo de 21 landmarks FSTT
- Hona & Stephan (2024) — T-Table Global 2023, 220k mediciones
- Liang et al. (2024) — Skull-to-Face, IEEE TVCG
- Qiu et al. (2022) — SCULPTOR, ACM TOG
