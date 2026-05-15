# Paso 8 — Deformación TPS

**Anterior:** `step7.md` | **Siguiente:** `step9.md`

| | |
|---|---|
| Worker | `tps_worker` — `backend/app/workers/tps_worker.py` |
| Herramienta | SciPy `RBFInterpolator` con regularización |
| Entrada | malla FLAME alineada (paso 7) + 21 puntos de control faciales (paso 5) + anchors posteriores |
| Salida | malla facial deformada en memoria |

## Qué hace

Aplica una corrección residual sobre la FLAME paramétrica ya ajustada. Los 21
puntos FSTT guían la deformación, pero no mandan con fuerza infinita: cada
landmark recibe un peso robusto según su residual, una tolerancia FSTT
algorítmica y una confianza por región anatómica. Los outliers influyen poco en
vez de doblar la cara.

El desplazamiento TPS se localiza cerca de los landmarks y se limita por vértice
para que no pueda rehacer la cabeza completa. Si aun así un candidato es de baja
confianza, el paso 9 mezcla menos desplazamiento (`alpha=0.65`, `0.4`, `0.2`) o
cae a FLAME paramétrica alineada.

## Implementación

```python
from scipy.interpolate import RBFInterpolator

rbf = RBFInterpolator(
    source,                        # landmarks FLAME alineados + anchors
    target - source,              # desplazamientos objetivo
    kernel="thin_plate_spline",
    degree=1,
    smoothing=100.0,
)
verts_deformed = verts_flame + rbf(verts_flame)
```

La exportación evalúa también candidatos acotados:

```python
verts_candidate = verts_flame + alpha * rbf(verts_flame)
```

## Función matemática

```
f(x) = Ax + b + Σ wᵢ · φ(‖x − qᵢ‖)
φ(r) = r² log(r)    ← función de base radial TPS en 3D
```

La componente afín `Ax + b` captura transformaciones globales.
La componente no lineal `Σ wᵢ φ` captura deformaciones locales.
El parámetro `smoothing=100.0` penaliza deformaciones demasiado agresivas.

## Regla crítica

El TPS se aplica sobre la malla FLAME ya alineada, no sobre el cráneo completo.
Eso reduce la extrapolación y hace que el problema sea numéricamente estable.

## Anchors de estabilización

1. Medir para cada vértice su distancia al landmark facial alineado más cercano
2. Tomar el 40% más lejano como pool candidato
3. Elegir 32 anchors con farthest-point sampling determinístico
4. Añadirlos al TPS como restricciones identidad (`source = target`)

Esto estabiliza especialmente nuca, lateral de cabeza y zonas posteriores que no
quedan directamente controladas por los 21 landmarks faciales.

## Suavidad y plausibilidad

La deformación residual se limita por vértice y se atenúa con distancia al
landmark más cercano. La superficie final recibe un suavizado Taubin conservador
para mejorar calidad visual sin cambiar topología ni convertir landmarks/FSTT en
ajustes rígidos.

## Publica en Redis

```json
{ "step": 8, "status": "done", "duration_ms": 38400 }
```

## No hace

- No persiste la malla — eso es paso 9
- No calcula normales del frontend — el backend usa normales recalculadas desde la malla real
