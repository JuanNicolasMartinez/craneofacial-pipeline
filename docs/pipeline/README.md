# Pipeline — índice

Cada paso tiene su propio archivo. Lee solo el que necesitas.

| Archivo | Paso | Nombre | Worker | Herramienta |
|---|---|---|---|---|
| `step1.md` | 1 | Ingesta del cráneo | — (router) | FastAPI |
| `step2.md` | 2 | Preprocesamiento geométrico | `mesh_worker` | `trimesh` |
| `step3.md` | 3 | Selección de landmarks | — (manual) | Three.js |
| `step4.md` | 4 | Perfil biológico | — (formulario) | FastAPI |
| `step5.md` | 5 | Vectores FSTT | `align_worker` | `core/fstt.py` |
| `step6.md` | 6 | Malla FLAME base | `align_worker` | FLAME .pkl |
| `step7.md` | 7 | Alineación cráneo–cara | `align_worker` | Procrustes / SVD |
| `step8.md` | 8 | Deformación TPS | `tps_worker` | SciPy RBF regularizado |
| `step9.md` | 9 | Exportación y trazabilidad | `export_worker` | trimesh |

## Cadena de ejecución

```
Usuario sube malla
  → step1 (router FastAPI, síncrono)
  → step2 (mesh_worker)
  → [manual] step3 landmarks
  → [manual] step4 perfil biológico
  → step5 + step6 + step7 (align_worker, cadena Celery)
  → step8 (tps_worker)
  → step9 (export_worker)
```

Los pasos 3 y 4 son manuales — no forman parte de la cadena Celery.
La implementación actual resuelve la geometría final en el helper de reconstrucción
invocado por el paso 9, pero conserva esta separación conceptual para trazabilidad
del pipeline.

## Geometría actual

La reconstrucción facial activa usa una sola rama:

1. normales recalculadas desde la malla real del cráneo
2. puntos de control FSTT en los 21 landmarks
3. Procrustes robusto con subconjunto estable de 14 landmarks
4. ajuste paramétrico FLAME (`shapedirs`) con prior fuerte de forma humana
5. FSTT y landmarks como restricciones suaves con tolerancia/confianza regional
6. TPS residual local, anchors posteriores, desplazamiento acotado y suavizado conservador
7. `confidence_score` con fallback humano exportable si el ajuste completo es dudoso

Si el TPS completo es implausible o de baja confianza, el job no se aborta por
geometría: exporta una versión degradada o Procrustes-only y registra
`quality_status`, `confidence_score` y advertencias en `params.json` y
`GET /cases/{id}/result`.

```python
# backend/app/workers/chain.py
chain(
    align_worker.s(job_id),   # pasos 5, 6, 7
    tps_worker.s(job_id),     # paso 8
    export_worker.s(job_id),  # paso 9
).apply_async()
```

## Validación

| Métrica | Descripción | Umbral esperado |
|---|---|---|
| Residual rígido robusto medio | Error Procrustes sobre inliers estables | baja confianza si sube |
| Residual rígido robusto máximo | Peor error rígido entre inliers | baja confianza si sube |
| Ratio bbox deformado/control | Escala anatómica por eje | baja confianza si sale de rango |
| Vértices finitos | Sin `NaN` ni `Inf` | obligatorio |
| Componentes conectados | Superficie facial única | `1` |

Métricas como P2P y Hausdorff siguen siendo futuras cuando exista una cara de
referencia; hoy la barrera dura es estructural, mientras los desacoples entre
FLAME, FSTT y landmarks reducen confianza de forma trazable.
