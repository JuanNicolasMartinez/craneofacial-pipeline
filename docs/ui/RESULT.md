# UI — Resultado y exportación

Módulo: `frontend/src/features/cases/` (sub-vista de detalle de caso)
Endpoint: `GET /cases/{id}/result`
Sistema de diseño: ver `DESIGN_SYSTEM.md`

---

## Layout

```
Layout (dos columnas)
├── Viewer 3D con superposición (flex: 1)
└── Panel lateral de resultado (320px fijo)
    ├── Header: título + status
    ├── Controles de visualización
    ├── Métricas de calidad
    ├── Variantes (si las hay)
    └── Exportación
```

Panel: `--bg-surface`, `--radius-lg`, `--border-subtle`, padding `--space-6`.

---

## Viewer 3D en modo resultado

El viewer muestra la malla facial reconstruida final. No muestra landmarks ni
sliders locales sobre la cara: esos controles quedaron limitados al paso de
selección/revisión porque en resultado generaban una lectura visual confusa.

Diferencia respecto al viewer vacío:
- Toolbar muestra "Resultado · Vista 3D" en lugar de "Vista 3D · Modo exploración"
- La cámara se centra en la malla facial resultante
- El modo landmarks está deshabilitado (no hay cursor crosshair)
- La descarga usa el `.ply` publicado por backend, sin deformaciones de cliente

---

## Panel lateral — controles de visualización

El panel muestra estado, advertencia si aplica y una tarjeta “Base científica
usada” con modelo, perfil FSTT, confianza y landmarks usados. No hay edición
local de piel en esta vista.

---

## Panel lateral — métricas de calidad

Solo se muestra si `p2p_error_mm` no es null (requiere cara de referencia).

```
Métricas de validación
─────────────────────
Error P2P          3.8 mm
Error Hausdorff   11.2 mm
```

Valores: 16px/500 `--text-primary`. Labels: 12px `--text-muted`.
Tooltip en cada métrica (icono `Info` 14px `--text-muted`):
- P2P: "Distancia euclidiana media entre mallas. Objetivo < 6 mm."
- Hausdorff: "Máxima desviación entre superficies. Objetivo < 15 mm."

Si no hay métricas: sección oculta, sin placeholder vacío.

---

## Panel lateral — variantes

No hay selector de variantes en Forense v1. La salida activa es `mean_fstt`.
Solo se habilitarán variantes delgada/media/gruesa cuando el backend tenga
desviaciones estándar o intervalos FSTT citados por fuente.

---

## Panel lateral — exportación

```
Exportar resultado
──────────────────
[Download] resultado.ply
           Malla facial reconstruida, formato 3D

[File]     params.json
           Parámetros completos del proceso
```

Cada item: IconButton `Download`/`FileText` 36px + texto dos líneas (nombre 14px/500 + descripción 12px `--text-muted`).

Al hacer clic: el backend genera una URL firmada del almacenamiento de objetos → `window.open(url)` → descarga directa.
El archivo no pasa por el servidor FastAPI.

Spinner en el botón durante la generación de URL (< 1s esperado).

---

## Estados

| Estado | Qué muestra |
|---|---|
| Cargando URLs | Spinner `--accent-blue` 24px en panel + "Preparando resultado..." |
| Resultado disponible | Layout completo con viewer + panel |
| Resultado con baja confianza | Descarga normal + warning + `confidence_score` |
| Sin resultado (job no completado) | Panel vacío con "El pipeline no ha completado. Ve a la pestaña Pipeline." + link |
| Error al cargar | `AlertCircle --accent-red` + mensaje + CTA para volver a Pipeline |

Si el último job del caso terminó en `error`, `GET /cases/{id}/result` no debe servir una reconstrucción vieja de un job anterior completado. La vista de resultado debe mostrar que no hay un resultado vigente y redirigir al usuario a revisar Pipeline.
