# Pipeline — índice

Cada paso tiene su propio archivo. Lee solo el que necesitas.

| Archivo | Paso | Nombre | Worker | Herramienta |
|---|---|---|---|---|
| `step1.md` | 1 | Ingesta del cráneo | — (router) | FastAPI |
| `step2.md` | 2 | Preprocesamiento geométrico | `mesh_worker` | PyMeshLab |
| `step3.md` | 3 | Selección de landmarks | — (manual) | Three.js |
| `step4.md` | 4 | Perfil biológico | — (formulario) | FastAPI |
| `step5.md` | 5 | Vectores FSTT | `align_worker` | `core/fstt.py` |
| `step6.md` | 6 | Malla FLAME base | `align_worker` | FLAME .pkl |
| `step7.md` | 7 | Alineación cráneo–cara | `align_worker` | Open3D |
| `step8.md` | 8 | Deformación TPS | `tps_worker` | SciPy RBF |
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

```python
# backend/app/workers/chain.py
chain(
    align_worker.s(job_id),   # pasos 5, 6, 7
    tps_worker.s(job_id),     # paso 8
    export_worker.s(job_id),  # paso 9
).apply_async()
```

## Validación (próxima iteración)

| Métrica | Descripción | Umbral esperado |
|---|---|---|
| P2P | Distancia euclidiana media entre mallas (mm) | 3–6 mm |
| Hausdorff | Máxima desviación entre superficies (mm) | < 15 mm |
| Error por landmark | Distancia por punto | < 5 mm |

Líneas base: SCULPTOR 1–3 mm · pipeline FSTT+TPS objetivo 3–6 mm.
