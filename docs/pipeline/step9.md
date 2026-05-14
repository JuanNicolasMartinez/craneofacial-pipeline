# Paso 9 — Exportación y trazabilidad

**Anterior:** `step8.md` | **Siguiente:** —

| | |
|---|---|
| Worker | `export_worker` — `backend/app/workers/export_worker.py` |
| Herramienta | trimesh |
| Entrada | malla facial deformada (paso 8) |
| Salida | `resultado.ply` + `params.json` en R2, row en `reconstructions` |

## Qué hace

Persiste el resultado final junto con todos los parámetros del proceso para garantizar reproducibilidad y auditabilidad.

## Archivos generados en R2

```
cases/{case_id}/jobs/{job_id}/resultado.ply    ← malla facial deformada
cases/{case_id}/jobs/{job_id}/params.json      ← registro completo del proceso
```

## Contenido de `params.json`

```json
{
  "case_id": "...",
  "job_id": "...",
  "pipeline_version": "1.0",
  "landmarks": [{ "label": "nasion", "x": 0, "y": 0, "z": 0, "nx": 0, "ny": 0, "nz": 1 }],
  "biological_profile": { "sex": "M", "ancestry": "latinoamerican", "confidence": 0.8 },
  "fstt_table": "T-Table-Global-2023",
  "fstt_k_factor": 0.0,
  "control_points": [{ "label": "nasion", "x": 0, "y": 0, "z": 6.2 }],
  "alignment_transform": [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]],
  "tps_kernel": "thin_plate_spline",
  "completed_at": "2025-05-13T10:00:00Z"
}
```

## Actualizaciones en DB

```sql
INSERT INTO reconstructions (job_id, r2_key_mesh, r2_key_params)
UPDATE pipeline_jobs SET status = 'completed', completed_at = now()
UPDATE cases SET status = 'completed'
```

## Publica en Redis

```json
{ "step": 9, "status": "done", "mesh_url": "...", "params_url": "..." }
```

El frontend recibe este mensaje por WebSocket y habilita la vista de resultado.

## No hace

- No calcula métricas de validación (P2P, Hausdorff) — requieren cara de referencia, implementación futura
- No genera previsualizaciones — el frontend carga el `.ply` directamente desde R2
