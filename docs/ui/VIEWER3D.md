# UI — Viewer 3D

Módulo: `frontend/src/features/viewer3d/`
Datos: URL firmada `.ply` desde `GET /cases/{id}/mesh` o `/result`
Sistema de diseño: ver `DESIGN_SYSTEM.md`

---

## Referencia visual

Las imágenes IMG_3704 e IMG_3705 muestran la estética objetivo: visualización 3D central sobre
fondo casi negro (`--bg-main`), dentro de una card `--radius-lg`, con toolbar interna discreta
y marcadores de colores semánticos sobre la superficie 3D.

---

## Layout del viewer

Card contenedora: `--bg-surface`, `--radius-lg`, `--border-subtle`. Ocupa el área principal del layout.

```
ViewerCard
├── Toolbar interna (header de la card)
│   ├── Izquierda: IconButton modo + label "Vista 3D | Modo exploración"
│   └── Derecha: IconButtons — alternar modo, fullscreen, export, opciones (...)
└── Canvas Three.js (flex: 1, fondo --bg-main)
```

Toolbar: 48px alto, `--bg-card`, `--border-subtle` borde inferior, padding `--space-4`.
Labels toolbar: 14px `--text-secondary`. Divisor vertical `|` entre título y subtítulo: 1px `--border-subtle`.

---

## Controles de cámara

`OrbitControls` de drei activos siempre:
- Click + drag → orbitar
- Scroll → zoom
- Click derecho + drag → pan

Cursor: `grab` en reposo, `grabbing` al arrastrar. En modo landmarks cambia a `crosshair`.

---

## Modos de representación

Pills en toolbar, 36px, `--radius-pill`:

| Modo | Icono Lucide | Descripción |
|---|---|---|
| Sólido | `Box` | malla rellena, material `MeshStandardMaterial` |
| Wireframe | `Grid3x3` | solo aristas, `--accent-blue` 40% opac |
| X-Ray | `ScanLine` | material semitransparente `opacity 0.35` |

Modo activo: fondo `--bg-elevated`, texto `--text-primary`.
Modo inactivo: fondo transparente, texto `--text-muted`.

---

## Iluminación y material

Fondo del canvas: `--bg-main` (#050607 en dark). Sin skybox.

Luces:
- `AmbientLight` intensidad 0.4
- `DirectionalLight` desde arriba-frente, intensidad 0.8
- `HemisphereLight` sky `--bg-elevated`, ground `--bg-card`, intensidad 0.3

Material cráneo: `MeshStandardMaterial`, color `#B6BABC` (`--text-secondary`), roughness 0.7, metalness 0.1.
Material cara (cuando hay resultado): color `--accent-blue` pastel, opacity configurable.

---

## Superposición cráneo + cara

Cuando hay resultado disponible, ambas mallas coexisten en el mismo canvas:

- Cráneo: siempre visible, material neutro `--text-secondary`
- Cara reconstruida: `--accent-blue` semitransparente, opacity controlada por slider

**Slider de opacidad:** en toolbar derecha, `input[type=range]`, 80px ancho, valor inicial 0.7.
Label: "Opacidad cara" 12px `--text-muted` + valor numérico 12px `--text-primary`.

**Toggles de visibilidad:** dos IconButtons circulares 36px con `Eye`/`EyeOff` Lucide.
- Toggle cráneo: activo `--accent-blue`, inactivo `--text-muted`
- Toggle cara: activo `--accent-purple`, inactivo `--text-muted`

---

## Indicadores de landmarks

Cuando el módulo de landmarks está activo (paso 3):

- Landmark colocado: esfera 4px radio, color `--accent-lime`, siempre visible (no ocluida por malla)
- Landmark activo (siguiente a colocar): esfera 6px, `--accent-blue`, pulso suave `scale 1→1.3` 1s
- Landmark pendiente: no tiene representación 3D (solo en el panel lateral)

Hover sobre landmark: tooltip flotante con nombre anatómico (14px, `--bg-elevated`, `--radius-md`, padding `--space-2 --space-3`).

Click derecho sobre landmark colocado: menú contextual mínimo — "Reubicar" · "Eliminar".

---

## Rendimiento

- Tamaño esperado: 5–20 MB por malla `.ply`
- Mallas > 100k vértices: simplificar con `SimplifyModifier` de Three.js al cargar (target 50k)
- Durante carga: spinner `--accent-blue` centrado en canvas + "Cargando malla..." 14px `--text-muted`
- Tiempo máx esperado de carga: 3–5s en conexión estándar

---

## Estados

| Estado | Qué muestra |
|---|---|
| Sin malla | Canvas vacío `--bg-main` + icono `Boxes` 48px `--text-muted` + "Sube un cráneo para comenzar" |
| Cargando | Canvas `--bg-main` + spinner `--accent-blue` 32px centrado |
| Modo exploración | Malla cargada, OrbitControls activos, cursor `grab` |
| Modo landmarks | Malla cargada, cursor `crosshair`, panel lateral de landmarks visible |
| Error de carga | Canvas `--bg-main` + `AlertCircle --accent-red` + mensaje + "Reintentar" |
