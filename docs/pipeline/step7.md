# Paso 7 — Alineación cráneo–cara

**Anterior:** `step6.md` | **Siguiente:** `step8.md`

| | |
|---|---|
| Worker | `align_worker` (mismo task que pasos 5 y 6) |
| Herramienta | Open3D |
| Entrada | malla FLAME (paso 6) + puntos de control faciales (paso 5) |
| Salida | malla FLAME transformada al sistema de referencia del cráneo |

## Qué hace

Lleva la malla FLAME al sistema de coordenadas del cráneo mediante una transformación rígida, de modo que ambas mallas convivan en el mismo espacio antes de la deformación TPS.

## Operaciones

1. Construir correspondencias: landmarks FLAME (32 puntos) ↔ puntos de control faciales del paso 5 (21 puntos)
2. Estimar transformación rígida con Open3D:
```python
o3d.pipelines.registration.TransformationEstimationPointToPoint()
# traslación + rotación + escala uniforme
```
3. Aplicar la transformación a todos los vértices de la malla FLAME

## Salida

- Malla FLAME transformada (mismos ~5000 vértices, nuevas coordenadas)
- Matriz de transformación 4×4 — se guarda en `job_steps.params` para trazabilidad

Pasa en memoria al paso 8.

## No hace

- No deforma la malla (eso es paso 8)
- No modifica el cráneo
