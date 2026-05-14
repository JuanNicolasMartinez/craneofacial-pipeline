# Paso 8 — Deformación TPS

**Anterior:** `step7.md` | **Siguiente:** `step9.md`

| | |
|---|---|
| Worker | `tps_worker` — `backend/app/workers/tps_worker.py` |
| Herramienta | SciPy `RBFInterpolator` |
| Entrada | malla FLAME alineada (paso 7) + 21 puntos de control faciales (paso 5) |
| Salida | malla facial deformada en memoria |

## Qué hace

Deforma la malla FLAME para que sus landmarks coincidan con los 21 puntos de control faciales derivados del FSTT. La deformación es suave y globalmente coherente.

## Implementación

```python
from scipy.interpolate import RBFInterpolator

rbf = RBFInterpolator(
    source,                      # landmarks FLAME alineados, shape [21, 3]
    target,                      # puntos de control FSTT, shape [21, 3]
    kernel='thin_plate_spline'
)
verts_deformed = rbf(verts_flame)  # deforma los ~5000 vértices
```

## Función matemática

```
f(x) = Ax + b + Σ wᵢ · φ(‖x − qᵢ‖)
φ(r) = r² log(r)    ← función de base radial TPS en 3D
```

La componente afín `Ax + b` captura transformaciones globales.
La componente no lineal `Σ wᵢ φ` captura deformaciones locales.
Los pesos `wᵢ` se obtienen resolviendo un sistema lineal.

## Variantes

Para generar múltiples reconstrucciones del mismo cráneo, el paso 5 se re-ejecuta con distintos valores de `k` y este paso corre una vez por cada variante.

## Publica en Redis

```json
{ "step": 8, "status": "done", "duration_ms": 38400 }
```

## No hace

- No persiste la malla — eso es paso 9
- No usa información adicional del cráneo más allá de los 21 puntos de control
