# UI — Selección de landmarks

Módulo: `frontend/src/features/landmarks/`
Datos: malla limpia en viewer, `PATCH /cases/{id}/landmarks`
Sistema de diseño: ver `DESIGN_SYSTEM.md`

---

## Referencia visual

Inspirado en los marcadores de la imagen IMG_3705: pins de colores semánticos sobre superficie 3D,
cada uno con icono y color con significado claro. El panel lateral sigue la estética del "Climbing log":
lista vertical con íconos de estado y detalle a la derecha.

---

## Layout en modo landmarks

```
Layout (dos columnas)
├── Viewer 3D (flex: 1)          → cursor crosshair, landmarks sobre la malla
└── Panel lateral (320px fijo)   → lista de 21 landmarks + controles
    ├── Header del panel
    ├── Lista de landmarks
    └── Footer con acciones
```

El panel lateral es una card `--bg-surface`, `--radius-lg`, `--border-subtle`, padding `--space-5`.

---

## Header del panel

```
"Landmarks"  |  "21 puntos · Rhine & Campbell 1980"
             17 / 21  [barra de progreso]
```

- Título: 16px/500 `--text-primary`
- Subtítulo: 13px `--text-muted`
- Barra de progreso: 4px alto, `--bg-card`, fill `--accent-lime`, `--radius-pill`, ancho 100%
- Contador `17 / 21`: 14px/500 `--text-primary`, alineado derecha

---

## Lista de landmarks

Lista vertical. Cada `LandmarkItem` (40px alto, padding `--space-2 --space-3`):

```
LandmarkItem
├── Indicador de estado (16px círculo)
├── Nombre anatómico (14px --text-primary o --text-muted si pendiente)
└── Coordenadas (12px --text-muted, solo si colocado): "x: 12.3  y: -4.1  z: 8.7"
```

**Estados del indicador:**

| Estado | Color | Icono |
|---|---|---|
| Colocado | `--accent-lime` relleno | `Check` 10px blanco |
| Activo (siguiente) | `--accent-blue` + borde pulsante | punto sólido |
| Pendiente | `--bg-card-soft` + borde `--border-subtle` | vacío |

Item activo: fondo `--bg-card-soft` en toda la fila, borde izq 2px `--accent-blue`.

Scroll interno si la lista excede la altura disponible. Sin scroll horizontal.

**Grupos colapsables** (opcional, si se implementa):
- "Medianos (10)" y "Bilaterales (11)" como secciones con chevron
- Inicialmente expandidos

---

## Interacción en el viewer

**Colocar landmark:**
1. El item activo en el panel pulsa suavemente
2. El usuario hace clic sobre la malla → Three.js `Raycaster` intersecta
3. Aparece esfera `--accent-lime` 4px en la posición
4. El panel marca ese landmark como colocado y avanza al siguiente automáticamente
5. Feedback: vibración suave del item en el panel (`transform: translateX(4px)` 100ms)

**Reubicar landmark ya colocado:**
- Clic derecho sobre esfera → menú contextual "Reubicar"
- El landmark vuelve a estado activo, el cursor espera nuevo clic

**Eliminar landmark:**
- Menú contextual → "Eliminar"
- La esfera desaparece, el item vuelve a pendiente
- El contador retrocede

**Cursor:** `crosshair` sobre la malla, `pointer` sobre esferas de landmarks existentes.

---

## Guía contextual

Al activar un landmark, el header del panel muestra:

```
[Icono anatómico]  nasion
"Punto entre los ojos, en la raíz nasal"
```

- Descripción: 12px `--text-muted`, máx 2 líneas
- La descripción viene de `constants.ts` junto con el label

No hay guía 3D superpuesta (no arrows flotantes sobre el cráneo) — solo el panel lateral.

---

## Footer del panel

```
[Limpiar todo]          [Guardar landmarks]
(SecondaryButton)       (PrimaryButton, disabled si < 21)
```

- `Guardar` habilitado solo cuando los 21 landmarks están colocados
- Al hacer clic: spinner en botón, `PATCH /cases/{id}/landmarks`, luego `CheckCircle --accent-green`

**Advertencia al salir con landmarks incompletos:**
Si el usuario navega fuera con < 21 landmarks: dialog de confirmación.
Card modal: "¿Salir sin guardar? Los landmarks no guardados se perderán."
Acciones: "Cancelar" (secundario) · "Salir sin guardar" (primario `--accent-red`).

---

## Estados

| Estado | Descripción |
|---|---|
| Modo exploración | Panel lateral oculto, botón "Colocar landmarks" en toolbar del viewer |
| Modo edición activo | Panel lateral visible, cursor crosshair, lista interactiva |
| Guardando | Spinner en botón Guardar, inputs no interactivos |
| Guardado con éxito | Toast `--accent-green` + redirect a sub-vista Pipeline |
| Error al guardar | Toast `--accent-red` con mensaje de la API, panel sigue activo |
