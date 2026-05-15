# Paso 2 — Preprocesamiento geométrico

**Anterior:** `step1.md` | **Siguiente:** `step3.md`

| | |
|---|---|
| Worker | `mesh_worker` — `backend/app/workers/mesh_worker.py` |
| Herramienta | `trimesh` |
| Entrada | malla activa en storage (`meshes/{case_id}/...`) |
| Salida | PLY canónico en storage (`meshes/{case_id}/preprocessed/{job_id}.ply`) |

## Qué hace

Prepara la malla sin criterios antropológicos. Este paso ocurre
automáticamente al ejecutar el pipeline, después de haber guardado landmarks y
perfil biológico. Por eso no cambia escala ni sistema de coordenadas: los
landmarks ya colocados deben seguir apuntando al mismo espacio 3D.

## Operaciones (en orden)

1. Cargar la malla activa desde storage con `trimesh`
2. Concatenar escenas a una sola `Trimesh` si el archivo trae varias geometrías
3. Validar que existan vértices y caras
4. Remover caras degeneradas y vértices no referenciados cuando sea seguro
5. Recalcular normales de la malla preparada
6. Exportar PLY canónico sin transformar coordenadas
7. UPDATE `meshes`: `status='preprocessed'`, `format='ply'`, `vertex_count=N`

## Publica en Redis

```json
{ "step": 2, "status": "done", "duration_ms": 320, "vertex_count": 12340 }
```

## No hace

- No interpreta anatomía ni aplica criterios forenses
- No normaliza escala ni cambia orientación
- No suaviza geometría después de que los landmarks ya fueron colocados
