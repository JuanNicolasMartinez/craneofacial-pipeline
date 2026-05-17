import { AxiosError } from "axios";

/** Extract a human-readable message from an API error, falling back to a default. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors come back as an array of {msg, loc}
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  }
  return fallback;
}
