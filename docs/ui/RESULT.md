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

El viewer muestra ambas mallas superpuestas. Ver `VIEWER3D.md` — sección "Superposición cráneo + cara".

Diferencia respecto al viewer vacío:
- Toolbar muestra "Resultado · Vista 3D" en lugar de "Vista 3D · Modo exploración"
- Slider de opacidad visible por defecto (valor inicial 0.7)
- Dos toggles de visibilidad activos: cráneo y cara
- El modo landmarks está deshabilitado (no hay cursor crosshair)

---

## Panel lateral — controles de visualización

**Opacidad de la cara reconstruida:**
```
Opacidad cara
[══════════●══] 70%
```
Slider `--accent-blue`, 100% ancho. Controla `material.opacity` de la malla facial en tiempo real.

**Toggles:**

```
[Eye]  Cráneo          activo → --accent-blue
[Eye]  Cara            activo → --accent-purple
[Eye]  Landmarks       activo → --accent-lime  (muestra las 21 esferas)
```

IconButtons 36px con label 13px `--text-secondary` a la derecha.

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

Si el job se ejecutó con múltiples valores de k, aparece un selector:

```
Variante de grosor
  ○ k = -1.0  (tejido delgado)
  ● k =  0.0  (media)  ← seleccionada
  ○ k = +1.0  (tejido grueso)
```

Radio buttons estilizados como pills 32px, `--bg-card-soft`, seleccionado `--bg-elevated` + borde `--accent-blue`.
Al cambiar variante: el viewer carga la malla correspondiente (nueva URL firmada de R2).

Sin comparación visual side-by-side en esta iteración — solo selector.

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

Al hacer clic: el backend genera la presigned URL de R2 → `window.open(url)` → descarga directa.
El archivo no pasa por el servidor FastAPI.

Spinner en el botón durante la generación de URL (< 1s esperado).

---

## Estados

| Estado | Qué muestra |
|---|---|
| Cargando URLs | Spinner `--accent-blue` 24px en panel + "Preparando resultado..." |
| Resultado disponible | Layout completo con viewer + panel |
| Sin resultado (job no completado) | Panel vacío con "El pipeline no ha completado. Ve a la pestaña Pipeline." + link |
| Error al cargar | `AlertCircle --accent-red` + mensaje + "Reintentar" |
