import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Skull } from "lucide-react";
import { useCurrentUser } from "../api/hooks/useAuth";

/**
 * Public entry point. If a session already exists, sends the user straight
 * into the app; otherwise shows the access buttons.
 */
export function LandingPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (user) navigate("/app", { replace: true });
  }, [user, navigate]);

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-10) var(--space-6)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "var(--space-4)",
          maxWidth: 640,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Skull size={32} style={{ color: "var(--accent-blue)" }} />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: "var(--text-primary)" }}>
          Craneofacial Pipeline
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Reconstrucción facial forense a partir de cráneo 3D, basada en el protocolo
          Rhine &amp; Campbell (1980) y la tabla FSTT T-Table-Global-2023.
        </p>

        <div
          style={{
            display: "flex",
            gap: "var(--space-3)",
            marginTop: "var(--space-4)",
          }}
        >
          <Link
            to="/login"
            className="btn-primary"
            style={{
              padding: "0 var(--space-8)",
              height: 48,
              fontSize: 15,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Iniciar sesión
          </Link>
          <Link
            to="/register"
            className="btn-secondary"
            style={{
              padding: "0 var(--space-8)",
              height: 48,
              fontSize: 15,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
}
