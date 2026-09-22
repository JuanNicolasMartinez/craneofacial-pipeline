# Design system

Sistema de diseño compartido por todos los módulos de UI. Extraído del documento de especificación.
**Referencia visual:** imágenes `IMG_3704` e `IMG_3705` (dashboard de escalada como ejemplo estético).

Todo componente debe importar estas variables y seguir estas reglas antes de definir estilos propios.

---

## Modos de color

Tres modos implementados con variables CSS en `:root[data-theme="dark|light|purple"]`.
El modo por defecto es `dark`. El selector del modo vive en `AppShell`.

### Modo oscuro (default)

```css
:root[data-theme="dark"] {
  --bg-page:       #0B0D0F;
  --bg-main:       #050607;
  --bg-surface:    #111315;
  --bg-card:       #17191C;
  --bg-card-soft:  #1D2023;
  --bg-elevated:   #24272B;

  --text-primary:   #F2F4F4;
  --text-secondary: #B6BABC;
  --text-muted:     #7E8588;

  --accent-blue:   #B7D6DF;
  --accent-green:  #AFCB73;
  --accent-lime:   #C9DD87;
  --accent-red:    #EF594E;
  --accent-orange: #BC7147;
  --accent-purple: #9581C4;

  --border-subtle: rgba(255,255,255,0.06);
  --border-medium: rgba(255,255,255,0.10);
}
```

### Modo claro

```css
:root[data-theme="light"] {
  --bg-page:       #F5F6F7;
  --bg-main:       #FFFFFF;
  --bg-surface:    #F2F3F5;
  --bg-card:       #E8EAED;
  --bg-card-soft:  #E1E4E8;
  --bg-elevated:   #D8DBE0;

  --text-primary:   #111315;
  --text-secondary: #43484E;
  --text-muted:     #6D7278;

  --accent-blue:   #0E61BA;
  --accent-green:  #4C7E36;
  --accent-lime:   #799F1D;
  --accent-red:    #B84238;
  --accent-orange: #C46A2F;
  --accent-purple: #6B4FA5;

  --border-subtle: rgba(0,0,0,0.06);
  --border-medium: rgba(0,0,0,0.10);
}
```

### Modo morado

```css
:root[data-theme="purple"] {
  --bg-page:       #1A1B27;
  --bg-main:       #10111A;
  --bg-surface:    #181828;
  --bg-card:       #201F34;
  --bg-card-soft:  #27273C;
  --bg-elevated:   #312F46;

  --text-primary:   #F1EEF7;
  --text-secondary: #B8B2CC;
  --text-muted:     #817D99;

  --accent-blue:   #9DBFE8;
  --accent-green:  #9FCB7A;
  --accent-lime:   #B4D698;
  --accent-red:    #D7726C;
  --accent-orange: #CC8A55;
  --accent-purple: #B689E9;

  --border-subtle: rgba(255,255,255,0.05);
  --border-medium: rgba(255,255,255,0.09);
}
```

---

## Radios (compartidos entre modos)

```css
--radius-xl:   36px;   /* AppShell, contenedor principal */
--radius-lg:   28px;   /* tarjetas grandes, viewer 3D */
--radius-md:   22px;   /* tarjetas medianas, panels */
--radius-sm:   12px;   /* métricas, items de menú, chips pequeños */
--radius-pill: 999px;  /* botones, nav items, badges */
```

Por debajo de 640px, `xl`, `lg` y `md` se reducen a 24/20/16px (ver Responsive).

---

## Responsive

La UI se compone casi toda con `style={{}}` inline, que no admite media
queries. Por eso **todo lo que dependa del tamaño de pantalla vive en
`index.css`** y se engancha a los componentes por clase. Si una propiedad
cambia con el breakpoint, no la pongas inline: el estilo inline gana siempre
a la hoja de estilos y la regla responsive quedaría muerta.

### Breakpoints

| Ancho | Layout |
|---|---|
| > 1024px | Visor + panel lateral de 340px |
| 861–1024px | Igual, panel reducido a 300px |
| ≤ 860px y alto ≥ 480px | Una columna: visor (52vh, mín. 280px) y panel debajo |
| ≤ 860px y alto < 480px | Móvil apaisado: vuelve a dos columnas (panel 200–260px) |
| ≤ 640px | Radios y espaciados reducidos; la barra superior envuelve |
| ≤ 380px | Se oculta el texto de marca de la barra superior |

En apaisado sobra ancho y falta alto: apilar dejaría el visor en una franja
inservible, así que ahí se conservan las dos columnas.

### Clases disponibles

| Clase | Para qué |
|---|---|
| `.app-viewport` | Raíz a pantalla completa (usa `--app-height`) |
| `.app-body` / `.app-body__viewer` / `.app-body__panel` | Rejilla visor + panel |
| `.top-nav` / `.top-nav__brand-text` | Barra superior |
| `.step-nav` | Pasos: envuelven en escritorio, scroll horizontal en móvil |
| `.camera-hud` + `__group` / `__btn` / `__size` | HUD del visor 3D |
| `.modal-overlay` / `.modal-card` / `.modal-actions` | Modales y tarjetas auth |
| `.case-grid` | Rejilla de casos (una columna por debajo de 560px) |
| `.hero-title` / `.hero-subtitle` / `.hero-actions` | Portadas |
| `.landmark-row` / `.landmark-row__remove` | Filas táctiles de landmarks |

### Reglas

- **Alto de ventana:** usa `var(--app-height)`, nunca `100vh`. En móvil `100vh`
  no descuenta la barra del navegador; el token resuelve a `100dvh` donde existe.
- **Anchos fijos:** nada de `width: 400`. Usa `width: "100%"` + `maxWidth`, o
  la clase `.modal-card`.
- **Inputs:** `fontSize` mínimo 16px; por debajo, iOS hace zoom al enfocar.
- **Objetivos táctiles:** mínimo 32×32px, 44px preferido para acciones primarias.
- **Texto variable** (referencia de caso, nombre de archivo, correo): siempre con
  `minWidth: 0` + `textOverflow: "ellipsis"`, o rompe la rejilla que lo contiene.
- **Movimiento:** se respeta `prefers-reduced-motion`.

---

## Tipografía

Fuente: **Inter** (Google Fonts). Pesos: 400 regular, 500 medium, 600 semibold.

| Rol | Tamaño | Peso | Color |
|---|---|---|---|
| Título principal | 20–24px | 600 | `--text-primary` |
| Subtítulo / label sección | 16–18px | 500 | `--text-primary` |
| Texto secundario | 14–16px | 400 | `--text-secondary` |
| Etiqueta / metadata | 12–14px | 400 | `--text-muted` |
| Valor destacado (métrica) | 16px | 500 | `--text-primary` |

---

## Espaciado

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
```

Padding en tarjetas grandes: `--space-6`. Gap entre tarjetas: `--space-8`.

---

## Botones

| Tipo | Forma | Fondo | Texto | Alto |
|---|---|---|---|---|
| Primario | pill (`--radius-pill`) | `--accent-blue` (dark/purple) / saturado (light) | `--bg-main` | 44–48px |
| Secundario | pill | `--bg-card-soft` | `--text-primary` | 44–48px |
| Icon button | círculo 40–44px | semitransparente | `--text-secondary` | 40–44px |

Hover: `transform: translateY(-1px)`, transición `all 180ms ease`.

---

## Iconografía

Biblioteca: **Lucide Icons** (ya en el proyecto via shadcn/ui).
Trazo: 1.5–2px stroke, esquinas redondeadas. Tamaño: 18–20px.

- Modo oscuro/morado: iconos `--text-secondary`, acentos para estados
- Modo claro: iconos `--text-primary` o `--text-secondary`

---

## Avatares

Circular, 28–32px, borde 2px con `--bg-card`. En grupos: `margin-left: -8px`.
Grupos encapsulados en pill con `--bg-card-soft`.

---

## Sombras

- Modo oscuro/morado: `box-shadow: 0 24px 80px rgba(0,0,0,0.35)` (opcional, suave)
- Modo claro: sombra ligera, siempre suave
- Elevación se indica con fondos más claros (`--bg-elevated`), no con sombras densas

---

## Componentes base requeridos

Estos componentes deben existir antes de implementar cualquier módulo:

```
AppShell          → contenedor principal, radio-xl, bg-main, gestiona data-theme
TopNavigation     → barra superior en pill
NavItem           → item de nav con icono + label, activo con bg-card-soft
PrimaryButton     → pill accent-blue/purple
SecondaryButton   → pill bg-card-soft
IconButton        → círculo semitransparente
SectionHeader     → título + metadata horizontal con divisores
Avatar / AvatarGroup
MiniBarChart      → barras 5–6px, color accent-lime/green
```

---

## Referencia visual (imágenes de ejemplo)

Las imágenes `IMG_3704` e `IMG_3705` muestran un dashboard de escalada con:
- Fondo `#0B0D0F` (dark), tarjetas con `border-radius` grande
- Nav superior en cápsula con item activo destacado en `--bg-card-soft`
- Visualización 3D central (mapa topográfico) con marcadores de colores semánticos:
  - Rojo (`--accent-red`) → alertas / puntos de señal
  - Azul claro (`--accent-blue`) → campamentos / puntos neutrales
  - Blanco → destino / cima
  - Verde lima (`--accent-lime`) → interacción activa
- Panel lateral izquierdo con mini gráficos de barras verdes y scatter dots azules
- Timeline inferior con cards horizontales de detalle (dos columnas: metadata izq, datos der)
- Avatares superpuestos en grupo (pill) en el header

Esta estética es la referencia para el viewer 3D y los paneles de métricas de esta app.
