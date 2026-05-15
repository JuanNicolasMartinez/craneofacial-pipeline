# Paso 5 — Cálculo de vectores FSTT

**Anterior:** `step4.md` | **Siguiente:** `step6.md`

| | |
|---|---|
| Worker | `align_worker` — `backend/app/workers/align_worker.py` |
| Herramienta | `backend/app/core/fstt.py` |
| Entrada | 21 landmarks (DB) + perfil biológico (DB) |
| Salida | 21 puntos de control faciales (en memoria, hacia paso 6) |

## Qué hace

Convierte los 21 landmarks craneales en 21 puntos de control faciales usando
datos de grosor de tejido blando (FSTT). En Forense v1 esos puntos son
observaciones estadísticas: guían la reconstrucción, pero no fuerzan a FLAME a
pasar exactamente por cada coordenada si eso rompe la forma humana.

## Fórmula

```
p_facial_i = p_craneal_i + d_i * n_i

p_craneal_i  → (x, y, z) del landmark i
n_i          → (nx, ny, nz) normal unitaria en ese punto
d_i          → media FSTT según sexo, región y edad
k            → ajuste exploratorio pequeño en mm, default 0.0
```

## Fuente de datos

`backend/app/core/fstt.py` — diccionario estático cargado en startup del worker. Nunca se consulta en runtime a ninguna API ni DB.

Ver contexto completo de FSTT en: `docs/architecture/STACK.md` (sección FSTT).

## Factor k

La tabla actual solo contiene medias por landmark; no contiene desviaciones
estándar citadas por celda. Por eso `k` no se presenta como σ real ni genera
variantes thin/mean/thick automáticamente. Se conserva como ajuste exploratorio
del pipeline, mientras la salida principal es `mean_fstt`.

Cuando existan desviaciones estándar o intervalos por fuente académica, se podrá
habilitar una salida de variantes delgada/media/gruesa con confianza explícita.

## Salida

Array de 21 `ControlPoint(x, y, z, label)` — pasa en memoria al paso 6. También
se registran en diagnósticos: profundidad FSTT, normal usada, tolerancia
algorítmica y peso regional por landmark.

## No hace

- No persiste los puntos de control como entidad independiente en DB
- No modifica ninguna malla
