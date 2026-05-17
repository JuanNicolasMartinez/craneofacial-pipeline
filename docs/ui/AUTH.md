# UI — Autenticación

Módulo: `frontend/src/pages/` + `frontend/src/components/UserMenu.tsx`
Endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
Sistema de diseño: ver `DESIGN_SYSTEM.md`. Lógica de auth: ver `docs/arquitecture/AUTH.md`.

---

## Rutas

La app usa `react-router-dom`. Mapa de rutas (`src/App.tsx`):

```
/                → LandingPage      (pública)
/login           → LoginPage        (pública)
/register        → RegisterPage     (pública)
/app             → AppShell         (protegida)
/app/profile     → ProfilePage      (protegida)
*                → redirige a /
```

Las rutas `/app/*` están envueltas en `ProtectedRoute`: mientras se resuelve la
sesión muestra un spinner; sin sesión redirige a `/login`.

---

## Landing (`/`)

Pantalla completa, `--bg-page`, contenido centrado. Reutiliza el hero del módulo:

```
LandingPage
├── Icono Skull en círculo (--bg-surface, 72px)
├── Título "Craneofacial Pipeline" (28px/600)
├── Descripción (14px, --text-muted)
└── Botones: "Iniciar sesión" (primario) · "Registrarse" (secundario)
```

Si ya existe sesión, redirige directamente a `/app`.

---

## Login (`/login`) y Registro (`/register`)

Tarjeta centrada a pantalla completa (no modal). `--bg-card`, `--radius-lg`,
padding `--space-8`, ancho 400px, borde `--border-medium`.

**Campos:**

| Pantalla | Campos |
|---|---|
| Login | Correo, Contraseña |
| Registro | Nombre completo, Correo, Contraseña (mín. 8 caracteres) |

Inputs: `--bg-surface`, borde `--border-subtle`, `--radius-md`. Botón de envío
primario a ancho completo, deshabilitado mientras la petición está en curso.

**Errores:** banner sobre el formulario — `--accent-red` sobre fondo rojo 10%
opacidad, borde rojo 30%. Mensaje devuelto por la API (credenciales incorrectas,
email duplicado) o validación local.

Enlace cruzado al pie: Login ↔ Registro.

Al éxito → `navigate("/app")`.

---

## Menú de usuario (`UserMenu`)

Vive en `TopNavigation`, reemplaza la antigua fila de botones de tema.

- **Disparador:** icon button circular 40px con icono `User`. Activo → `--bg-elevated`.
- **Dropdown:** flotante (`position: absolute`), anclado abajo-derecha. `--bg-card`,
  borde `--border-medium`, `--radius-md`, sombra. Cierra al hacer click fuera.

**Contenido del dropdown:**

```
UserMenu (dropdown)
├── Cabecera: full_name (14px/600) + email (12px, --text-muted)
├── ── divisor ──
├── Tema: tres botones — Oscuro (Moon) · Claro (Sun) · Púrpura (Sparkles)
│         el activo se resalta con borde --accent-blue
├── ── divisor ──
├── "Perfil y ajustes"  (icono Settings)  → /app/profile
└── "Cerrar sesión"     (icono LogOut, --accent-red) → logout → /
```

El tema se aplica como atributo `data-theme` en `<html>` y se persiste en
`localStorage` (hook `useTheme`).

---

## Perfil (`/app/profile`)

Página de solo lectura. `TopNavigation` + tarjeta centrada (`--bg-surface`, ancho 520px).

```
ProfilePage
├── Botón "Volver" (secundario) → /app
└── Tarjeta
    ├── Avatar (icono User) + título "Perfil"
    ├── Nombre completo
    ├── Correo
    └── Miembro desde (fecha de registro)
```

La edición de perfil queda fuera del alcance de la auth básica.

---

## Estados

- **Cargando sesión:** spinner centrado a pantalla completa (`ProtectedRoute`).
- **Error de credenciales / registro:** banner rojo dentro del formulario.
- **Logout:** limpia el caché de TanStack Query y redirige a la landing.

Regla: todo estado de error tiene icono + texto, nunca solo color.
