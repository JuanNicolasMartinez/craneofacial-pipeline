# UI — Control del pipeline

Módulo: `frontend/src/features/pipeline/`
Endpoints: `POST /cases/{id}/pipeline/run`, `WS /ws/jobs/{job_id}`
Sistema de diseño: ver `DESIGN_SYSTEM.md`

---

## Referencia visual

El panel de progreso sigue la estética del "Climbing log" de IMG_3704:
lista vertical tipo timeline con estado por evento, card de detalle a la derecha de cada item.

---

## Layout

```
Contenido principal
├── Card configuración (--bg-surface, --radius-lg)   izquierda 340px
└── Card progreso     (--bg-surface, --radius-lg)    flex: 1
```

Ambas cards con padding `--space-6`, `--border-subtle`, gap `--space-8` entre ellas.

---

## Card configuración (pre-ejecución)

Visible antes de iniciar el pipeline. Se colapsa (o se deshabilita) durante la ejecución.

**Resumen del caso (no editable):**
```
Perfil biológico
  Sexo:      Masculino
  Ancestría: Latinoamericana
  Tabla FSTT: T-Table Global 2023
```
Texto 13px `--text-secondary`. Labels 12px `--text-muted`. Divisores horizontales `--border-subtle`.

**Parámetro k — ajuste exploratorio FSTT:**

Slider horizontal:
- Label: "Ajuste exploratorio FSTT (k)" 13px `--text-secondary`
- Rango: -1.5 · -1.0 · -0.5 · 0.0 · +0.5 · +1.0 · +1.5 (step 0.5)
- Valor actual: pill `--bg-elevated` 13px/500, centrado bajo el slider
- Descripción del valor actual:
  - `0.0` → "Grosor medio (recomendado)"
  - `> 0` → "Tejido más grueso (+N)"
  - `< 0` → "Tejido más delgado (−N)"
- Color del track: `--accent-blue`, thumb: `--text-primary`

La UI no presenta `k` como desviación estándar real porque la tabla actual solo
contiene medias FSTT por celda.

**Botón ejecutar:**
PrimaryButton full-width 48px: "Reconstruir cráneo →"
Deshabilitado si: no hay landmarks guardados o no hay perfil biológico.
Tooltip en estado deshabilitado: "Completa los landmarks y el perfil biológico primero".

---

## Card progreso (durante ejecución)

Header de la card:
```
"Pipeline en ejecución"   |   "Caso CASO-2025-084"
Tiempo transcurrido: 00:42
```
Tiempo: 13px `--text-muted`, actualizado cada segundo.

**Lista de pasos — estilo timeline:**

Línea vertical 2px `--border-subtle` conectando todos los pasos.
Cada `PipelineStep` (48px alto):

```
[Indicador 28px]  [Nombre del paso]         [Duración o estado]
      │
```

**Indicadores por estado:**

| Estado | Visual |
|---|---|
| `done` | Círculo sólido `--accent-green`, icono `Check` 14px blanco |
| `running` | Círculo `--accent-blue` con spinner rotando 1s |
| `pending` | Círculo `--bg-card`, borde `--border-subtle` |
| `error` | Círculo `--accent-red`, icono `X` 14px blanco |

Nombre del paso:
- `done`: `--text-primary` 14px
- `running`: `--text-primary` 14px/500
- `pending`: `--text-muted` 14px
- `error`: `--accent-red` 14px

Duración (columna derecha):
- `done`: "3.2s" 12px `--text-muted`
- `running`: animación de puntos "···" `--accent-blue`
- `pending`: vacío
- `error`: "Error" 12px `--accent-red`

**Los 9 pasos en orden:**
1. Ingesta del cráneo
2. Preprocesamiento geométrico
3. Landmarks *(marcado como manual, sin spinner)*
4. Perfil biológico *(marcado como manual)*
5. Vectores FSTT
6. Malla FLAME base
7. Alineación cráneo–cara
8. Deformación TPS
9. Exportación

Los pasos 3 y 4 muestran badge "Manual" en lugar de indicador de progreso — siempre `done` al iniciar el pipeline (ya se completaron antes).

---

## Reconexión WebSocket

Si se pierde la conexión WS durante la ejecución:
- Banner amarillo bajo el header de la card: "Conexión perdida. Reconectando..." + spinner 14px `--accent-orange`
- Reintento automático cada 3s (máx 5 intentos)
- Si no reconecta: "No se pudo reconectar. El pipeline sigue corriendo." + botón "Recargar página"
- Al reconectar: banner desaparece, el estado se sincroniza con `GET /cases/{id}/pipeline/status`

---

## Notificaciones al completar

**Éxito:** toast esquina sup-der, `--bg-card`, borde izq 3px `--accent-green`, icono `CheckCircle`:
"Reconstrucción completada. Ver resultado →" (el texto es un link que navega a la sub-vista Resultado).
Persiste hasta que el usuario lo cierra (no auto-desaparece).

**Error en un paso:** toast `--accent-red` con el nombre del paso y el mensaje de error.
Botón en la card: "Ver detalle del error" → expande un panel con `job_steps.params` en JSON
formateado (12px monospace, `--bg-card`, `--radius-md`).
Botón "Reintentar pipeline" → re-ejecuta desde el paso fallido.

---

## Estados

| Estado | Qué muestra |
|---|---|
| Sin job activo | Card configuración completa + botón "Reconstruir" |
| Corriendo | Card configuración colapsada (solo resumen) + card progreso con timeline |
| Completado | Timeline con todos en `done` + botón "Ver resultado" PrimaryButton |
| Error | Timeline con paso en rojo + detalle del error + botón "Reintentar" |
