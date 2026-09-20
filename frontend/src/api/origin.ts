/**
 * Origen del backend.
 *
 * Con `VITE_API_URL` / `VITE_WS_URL` definidas en build time, mandan esas (API
 * y SPA en dominios distintos). Sin ellas:
 *  - en `pnpm dev`, el backend local en :8000;
 *  - en un build de producción, el mismo origen que sirve el SPA — que es el
 *    caso del despliegue de contenedor único, donde el api sirve el `dist/`.
 */
const sameOriginWs = () =>
  `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

export const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:8000" : "");

export const WS_URL =
  import.meta.env.VITE_WS_URL ?? (import.meta.env.DEV ? "ws://localhost:8000" : sameOriginWs());
