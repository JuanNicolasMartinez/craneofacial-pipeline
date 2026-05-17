# Paso 1 — Ingesta del cráneo

**Anterior:** — | **Siguiente:** `step2.md`

| | |
|---|---|
| Worker | — (síncrono en router) |
| Herramienta | FastAPI `UploadFile` |
| Entrada | archivo .ply / .obj / .stl |
| Salida | malla raw en el almacenamiento de objetos, row en `meshes` |

## Qué hace

Recibe el archivo del cráneo, lo valida y lo persiste en el almacenamiento de objetos.

## Trigger

```
POST /cases/{id}/mesh   (multipart/form-data)
```

## Operaciones

1. Valida extensión (`.ply`, `.obj`, `.stl`) y tamaño máximo (50 MB)
2. Stream directo al almacenamiento de objetos — key: `cases/{case_id}/raw{ext}`
3. INSERT en `meshes`: `r2_key`, `format`, `status='uploaded'`, `file_size_bytes`

## Respuesta

```json
{ "case_id": "...", "mesh_id": "...", "r2_key": "...", "format": "ply" }
```

## No hace

- No limpia ni modifica la malla (eso es paso 2)
- No usa Celery — es síncrono, responde inmediatamente
