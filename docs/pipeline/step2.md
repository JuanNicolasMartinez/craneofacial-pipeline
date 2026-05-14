# Paso 2 — Preprocesamiento geométrico

**Anterior:** `step1.md` | **Siguiente:** `step3.md`

| | |
|---|---|
| Worker | `mesh_worker` — `backend/app/workers/mesh_worker.py` |
| Herramienta | PyMeshLab |
| Entrada | malla raw en R2 (`cases/{id}/raw{ext}`) |
| Salida | malla limpia en R2 (`cases/{id}/clean.ply`) |

## Qué hace

Limpia la malla sin criterios antropológicos — solo estabilidad geométrica para los pasos siguientes.

## Operaciones (en orden)

1. `meshing_remove_connected_component_by_face_number` — elimina componentes aisladas
2. `meshing_repair_non_manifold_edges` — corrige normales invertidas
3. `apply_coord_laplacian_smoothing` (`iterations=3`) — suavizado controlado, preserva detalle anatómico
4. Normalización de escala a unidades métricas (mm)
5. Sube resultado a R2: `cases/{case_id}/clean.ply`
6. UPDATE `meshes`: `status='preprocessed'`, `vertex_count=N`

## Publica en Redis

```json
{ "step": 2, "status": "done", "vertices": 12340 }
```

## No hace

- No interpreta anatomía ni aplica criterios forenses
- No modifica la topología de la malla más allá de la limpieza
