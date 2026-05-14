# Paso 5 — Cálculo de vectores FSTT

**Anterior:** `step4.md` | **Siguiente:** `step6.md`

| | |
|---|---|
| Worker | `align_worker` — `backend/app/workers/align_worker.py` |
| Herramienta | `backend/app/core/fstt.py` |
| Entrada | 21 landmarks (DB) + perfil biológico (DB) |
| Salida | 21 puntos de control faciales (en memoria, hacia paso 6) |

## Qué hace

Convierte los 21 landmarks craneales en 21 puntos de control faciales usando datos de grosor de tejido blando (FSTT).

## Fórmula

```
p_facial_i = p_craneal_i + d_i * n_i

p_craneal_i  → (x, y, z) del landmark i
n_i          → (nx, ny, nz) normal unitaria en ese punto
d_i          → FSTT_TABLE[tabla][sex][label]['mean'] + k * FSTT_TABLE[...]['std']
k            → factor de variante (default 0.0, rango ±1.5)
```

## Fuente de datos

`backend/app/core/fstt.py` — diccionario estático cargado en startup del worker. Nunca se consulta en runtime a ninguna API ni DB.

Ver contexto completo de FSTT en: `docs/architecture/STACK.md` (sección FSTT).

## Factor k (variantes)

| k | Significado |
|---|---|
| `0.0` | reconstrucción con grosor medio (default) |
| `+1.0` | tejido más grueso (+1σ) |
| `-1.0` | tejido más delgado (-1σ) |

## Salida

Array de 21 `ControlPoint(x, y, z, label)` — pasa en memoria al paso 6.
Se serializa en `job_steps.params` para trazabilidad, no tiene tabla propia en DB.

## No hace

- No persiste los puntos de control como entidad independiente en DB
- No modifica ninguna malla
