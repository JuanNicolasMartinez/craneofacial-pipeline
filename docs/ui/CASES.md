# UI — Casos

Módulo: `frontend/src/features/cases/`
Endpoints: `GET /cases`, `POST /cases`
Sistema de diseño: ver `DESIGN_SYSTEM.md`

---

## Layout general

`AppShell` con `--radius-xl` y `--bg-main`. La vista de casos es la pantalla de entrada a la app.
Estructura:

```
AppShell
├── TopNavigation        (Overview · Casos · Métricas)
└── Contenido
    ├── SectionHeader    (título "Casos forenses" + fecha)
    └── Grid de casos    (lista de CaseCards)
```

---

## TopNavigation

Barra superior en pill (`--radius-pill`, `--bg-surface`). Contiene:

- Items: `Overview` · `Casos` · `Pipeline` — icono Lucide 18px + label 14px
- Item activo: fondo `--bg-card-soft`, texto `--text-primary`
- Items inactivos: texto `--text-secondary`
- Botón primario derecho: `+ Nuevo caso` — pill `--accent-blue`, texto `--bg-main`, 44px alto
- Icon buttons circulares: notificaciones, ajustes (40px, semitransparente)
- Avatar de usuario: 28–32px circular, borde 2px `--bg-card`

---

## Vista: lista de casos

Grid de `CaseCard` con `gap: --space-8`. Cada card:

```
CaseCard  (--bg-surface, --radius-lg, --border-subtle, padding --space-6)
├── Header: case_ref (16px/500) + badge de status
├── Metadata: fecha · operador (14px, --text-muted, separados por divisor 1px)
└── Footer: botón "Abrir" (secundario) + indicador de paso actual
```

**Badge de status:**

| Status | Color fondo | Color texto |
|---|---|---|
| `created` | `--bg-card-soft` | `--text-muted` |
| `landmarks_ready` | `--accent-blue` 15% opac | `--accent-blue` |
| `running` | `--accent-orange` 15% opac | `--accent-orange` |
| `completed` | `--accent-green` 15% opac | `--accent-green` |
| `error` | `--accent-red` 15% opac | `--accent-red` |

Badge: `--radius-pill`, 12px, padding `4px 10px`. Siempre icono Lucide + texto (nunca solo color).

**Estado vacío:** icono `FolderOpen` 48px `--text-muted` centrado + "Sin casos. Crea el primero." + PrimaryButton.

**Estado cargando:** skeleton de 3 CaseCards, `--bg-card-soft`, pulse suave `opacity 0.5→1` 1.2s.

---

## Vista: crear caso

Modal sobre el contenido. Overlay `rgba(0,0,0,0.45)`.
Card: `--bg-surface`, `--radius-lg`, padding `--space-6`, max-width 480px.

**Campos:**

| Campo | Tipo | Validación |
|---|---|---|
| Referencia | text | requerido, máx 100 chars |
| Notas | textarea 3 líneas | opcional |
| Operador | text | requerido |

Inputs: `--bg-card`, borde `--border-subtle`, `--radius-md`, 40px alto.
Focus: borde `--accent-blue`, sin outline nativo.

Acciones: `Cancelar` (secundario izq) · `Crear caso` (primario der, deshabilitado si inválido).
Al confirmar: spinner en botón → redirect `/cases/{id}`.

---

## Vista: detalle de caso

SectionHeader: `case_ref` 22px/600 · metadata horizontal con divisores 1px · AvatarGroup.

Sub-nav en pills 36px: `Malla 3D` · `Landmarks` · `Pipeline` · `Resultado`

---

## Estados de error

- **Lista falla:** card con `AlertCircle --accent-red` + "Reintentar"
- **Creación falla:** toast esquina sup-der, borde izq 3px `--accent-red`, desaparece 4s
- **Éxito:** mismo patrón, borde `--accent-green`, icono `CheckCircle`

Regla: todo estado de error tiene icono + texto, nunca solo color.
