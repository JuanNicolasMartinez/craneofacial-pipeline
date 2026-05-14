# Paso 4 — Perfil biológico

**Anterior:** `step3.md` | **Siguiente:** `step5.md`

| | |
|---|---|
| Worker | — (formulario, síncrono en router) |
| Herramienta | FastAPI |
| Entrada | estimación del operador |
| Salida | row en `biological_profiles`, tabla FSTT seleccionada |

## Qué hace

Registra la estimación del perfil biológico del individuo. Determina qué tabla FSTT se aplica en el paso 5.

## Trigger

```
PATCH /cases/{id}/biological-profile
```

## Campos

| Campo | Valores válidos |
|---|---|
| `sex` | `M` · `F` |
| `ancestry` | `global` · `latinoamerican` · `turkish` · `korean` · `caucasian` |
| `age_range` | `18-35` · `35-50` · `50+` · `unknown` |
| `confidence` | float 0.0–1.0 |

## Lógica de selección de tabla FSTT

```python
# backend/app/core/fstt.py
if ancestry == 'latinoamerican': tabla = 'Moritsugui-2022'
else:                            tabla = 'T-Table-Global-2023'
```

Prioridad: tabla regional > tabla global. Si no hay tabla regional disponible, cae a `T-Table-Global-2023`.

## Respuesta

```json
{ "fstt_table": "T-Table-Global-2023", "confidence": 0.8 }
```

Queda en DB para trazabilidad completa del proceso.

## No hace

- No estima automáticamente el perfil desde la malla (requeriría modelo ML adicional)
- No bloquea el pipeline si `confidence` es bajo — lo documenta
