# AUTH.md

Autenticación y propiedad de casos. Cada caso forense pertenece a un usuario; un usuario solo ve y opera sus propios casos.

Alcance actual: auth básica con **registro y login** propios. Sin inicio de sesión con redes sociales.

---

## Modelo

- **`User`** (`backend/app/models/user.py`) — `id`, `email` (único), `full_name`, `hashed_password`, `is_active`, `created_at`.
- **`Case.user_id`** — FK obligatoria a `users.id`. Reemplaza el antiguo campo de texto `created_by`. Ver `DB.md`.

---

## Flujo

```
Registro / Login
  cliente  → POST /auth/register | /auth/login  { email, password, ... }
  backend  → valida → emite JWT → Set-Cookie HttpOnly  → 200/201 + UserRead

Petición autenticada
  cliente  → cualquier request (el navegador adjunta la cookie)
  backend  → get_current_user lee la cookie, decodifica el JWT, carga el User
           → 401 si falta / inválida / usuario inactivo

Logout
  cliente  → POST /auth/logout
  backend  → borra la cookie
```

---

## Contraseñas

- Hash con **bcrypt** vía passlib (`backend/app/core/security.py`).
- La contraseña en claro nunca se almacena ni se loguea.
- Mínimo 8 caracteres, validado en el schema `UserRegister`.

## Token y sesión

- JWT firmado con **HS256** (`python-jose`). Payload: `sub` = `user.id`, `exp` = expiración.
- El token viaja en una cookie **`HttpOnly`**, nunca en `localStorage`.
  JavaScript no puede leer la cookie → inmune al robo de token por XSS.
- Configuración en `backend/app/core/config.py`: `JWT_SECRET_KEY`, `JWT_ALGORITHM`,
  `ACCESS_TOKEN_EXPIRE_MINUTES`, `COOKIE_NAME`, `COOKIE_SECURE`, `COOKIE_SAMESITE`.

`JWT_SECRET_KEY` es obligatoria — debe definirse en `backend/.env.local` (dev) y como
variable de entorno en producción. Generar un valor fuerte con `openssl rand -hex 32`.

### Política de cookie por entorno

| Escenario | `COOKIE_SAMESITE` | `COOKIE_SECURE` | Por qué |
|---|---|---|---|
| Mismo dominio / desarrollo | `lax` | `false` en dev, `true` en prod | Frontend y API comparten origen (o `localhost`). La cookie es *same-site*. |
| Dominios distintos | `none` | `true` | El frontend (SPA) y la API están en dominios distintos. La cookie es *cross-site*: `SameSite=None` es obligatorio para que viaje en las peticiones XHR, y los navegadores exigen `Secure` (HTTPS) junto a `None`. |

La elección depende de **cómo se sirvan** el frontend y la API, no del proveedor:

- Si ambos se publican bajo el mismo dominio (p. ej. la API tras `/api` con un
  reverse proxy delante del frontend), la cookie es same-site → `lax`.
- Si se publican en dominios distintos, es cross-site → `none` + `secure`.

El backend valida al arrancar que `COOKIE_SAMESITE=none` venga siempre con
`COOKIE_SECURE=true`. `CORS_ORIGINS` debe listar el dominio exacto del frontend
— el comodín `*` no es válido con credenciales. Detalle de las variables de
despliegue en `docs/arquitecture/DEPLOY.md`.

---

## Endpoints — `app/api/routes/auth.py`

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/register` | Crea cuenta, emite cookie de sesión. `409` si el email ya existe. |
| `POST` | `/auth/login` | Valida credenciales, emite cookie. `401` si son incorrectas. |
| `POST` | `/auth/logout` | Borra la cookie de sesión. `204`. |
| `GET` | `/auth/me` | Devuelve el usuario autenticado. `401` si no hay sesión. |

`UserRead` nunca incluye `hashed_password`.

---

## Aislamiento de casos

La dependencia **`get_current_user`** (`app/api/deps.py`) protege todos los endpoints
de `/cases` y los routers relacionados (`meshes`, `landmarks`, `pipeline`).

- `create_case` asigna `user_id` = usuario autenticado.
- `list_cases` filtra por `Case.user_id`.
- `get_case(case_id, user_id)` solo devuelve el caso si pertenece al usuario.
- Acceder a un caso de otro usuario devuelve **`404`** (no `403`) — no se revela su existencia.

---

## Frontend

- `withCredentials: true` en el cliente axios (`src/api/client.ts`) para enviar la cookie.
- `useCurrentUser()` (`src/api/hooks/useAuth.ts`) resuelve la sesión con `GET /auth/me`.
- `ProtectedRoute` (`src/components/ProtectedRoute.tsx`) protege las rutas `/app`.
- Detalle de la UI (landing, login, registro, menú de usuario, perfil) en `docs/ui/AUTH.md`.

---

## Convenciones

- La lógica de auth vive en `services/auth_service.py` — los routers no la contienen.
- El token nunca se expone al JavaScript del cliente.
- En producción: `COOKIE_SECURE=true` y un `JWT_SECRET_KEY` fuerte y secreto.
