# Paso 9 — Exportación y trazabilidad

**Anterior:** `step8.md` | **Siguiente:** —

| | |
|---|---|
| Worker | `export_worker` — `backend/app/workers/export_worker.py` |
| Herramienta | trimesh |
| Entrada | malla facial FLAME deformada + diagnósticos geométricos |
| Salida | un `.ply` final + `params.json` en el almacenamiento de objetos, row en `reconstructions` |

## Qué hace

Persiste el resultado final junto con los parámetros necesarios para reproducibilidad
y auditabilidad. La salida activa del pipeline es una sola reconstrucción facial,
pero la geometría de baja confianza ya no bloquea la exportación: si el TPS
completo es inestable, se publica una versión acotada o Procrustes-only que
mantiene forma humana.

## Archivos generados en el almacenamiento de objetos

```
results/{job_id}/result_flame.ply  ← malla facial final
results/{job_id}/params.json       ← registro del proceso
```

## Contenido de `params.json`

```json
{
  "job_id": "...",
  "case_id": "...",
  "fstt_table": "T-Table-Global-2023",
  "fstt_k_factor": 0.0,
  "sex": "M",
  "ancestry": "latinoamerican",
  "age_range": "18-35",
  "n_landmarks": 21,
  "source_mesh_format": "ply",
  "method": "forensic_v1_soft_fstt_flame_prior",
  "forensic_model_version": "forensic_v1_soft_fstt_flame_prior",
  "flame_template": "generic_model.pkl",
  "tps_smoothing": 100.0,
  "normals_source": "nearest_skull_vertex_normal",
  "procrustes_scale": 104.3,
  "quality_status": "degraded",
  "confidence_score": 0.68,
  "warning_message": "Reconstrucción de baja confianza...",
  "selected_candidate": "anchored_tps_alpha_0.40",
  "blend_alpha": 0.4,
  "diagnostics": {
    "fstt_profile": {
      "sex": "M",
      "ancestry": "latinoamerican",
      "age_range": "18-35",
      "variant": "mean_fstt"
    },
    "fstt_depths_by_label": { "glabella": 5.9 },
    "fstt_constraint_tolerances_by_label": { "glabella": 4.0 },
    "rigid_residual_mean_mm": 1.7,
    "rigid_residual_max_mm": 3.2,
    "robust_rigid_residual_mean_mm": 1.2,
    "shape_prior_enabled": true,
    "anchor_count": 32
  },
  "generated_at": "2025-05-13T10:00:00Z"
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
{ "step": 9, "status": "done", "duration_ms": 12500 }
```

El frontend recibe este mensaje por WebSocket y habilita la vista de resultado.
Las URLs firmadas se obtienen después vía `GET /cases/{id}/result`.

## Confianza y plausibilidad

Antes de subir el `.ply`, el backend evalúa candidatos con criterios duros y
criterios de confianza.

Chequeos duros:

- aparece algún vértice no finito
- la topología deja de ser una sola superficie conectada

Criterios de confianza:

- residual rígido robusto medio/máximo
- bbox respecto a puntos FSTT y FLAME alineada
- landmarks downweight-eados por residual alto
- desplazamiento residual y candidato `alpha` elegido

Si el TPS completo es de baja confianza, el backend prueba candidatos menos
agresivos y elige el primero que preserve forma humana. El job queda
`completed`, pero `params.json`, `job_steps.params` y `GET /cases/{id}/result`
marcan `quality_status`, `confidence_score` y `warning_message`.

Solo se publica `status="error"` cuando faltan datos indispensables o ocurre un
error real de ejecución: malla ilegible, landmarks incompletos, perfil faltante,
plantilla FLAME inválida, etc.

## No hace

- No calcula métricas de validación (P2P, Hausdorff) — requieren cara de referencia, implementación futura
- No genera previsualizaciones — el frontend carga el `.ply` directamente desde el almacenamiento vía URL firmada
