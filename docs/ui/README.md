# UI — Especificaciones de interfaz

Sistema de diseño: **`DESIGN_SYSTEM.md`** — leer primero antes de cualquier otro archivo de este directorio.

## Módulos

| Archivo | Módulo | Feature path |
|---|---|---|
| `DESIGN_SYSTEM.md` | Tokens, paleta, tipografía, componentes base | global |
| `AUTH.md` | Landing, login, registro, menú de usuario, perfil | `pages/`, `components/UserMenu` |
| `CASES.md` | Lista y gestión de casos | `features/cases/` |
| `VIEWER3D.md` | Visualizador 3D de mallas | `features/viewer3d/` |
| `LANDMARKS.md` | Selección interactiva de landmarks | `features/landmarks/` |
| `PIPELINE.md` | Control del pipeline y progreso | `features/pipeline/` |
| `RESULT.md` | Resultado y exportación | `features/cases/result` |

## Modos de color

Tres modos implementados con variables CSS: `dark` (default) · `light` · `purple`.
Variables y tokens completos en `DESIGN_SYSTEM.md`.

## Referencia visual

Las imágenes `IMG_3704` e `IMG_3705` son el ejemplo estético de referencia:
dashboard oscuro, premium, con visualización 3D central, marcadores semánticos de colores,
panel lateral de métricas con mini gráficos, y timeline de actividad.
