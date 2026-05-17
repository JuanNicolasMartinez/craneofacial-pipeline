import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Skull } from "lucide-react";
import { useLogin } from "../api/hooks/useAuth";
import { apiErrorMessage } from "../api/errors";
import {
  authPageStyle,
  authCardStyle,
  authInputStyle,
  authLabelStyle,
  authLabelTextStyle,
  authErrorStyle,
} from "./authStyles";

export function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ email, password });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo iniciar sesión"));
    }
  };

  return (
    <div style={authPageStyle}>
      <form onSubmit={handleSubmit} style={authCardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Skull size={22} style={{ color: "var(--accent-blue)" }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            Iniciar sesión
          </h2>
        </div>

        {error && <div style={authErrorStyle}>{error}</div>}

        <label style={authLabelStyle}>
          <span style={authLabelTextStyle}>Correo</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="analista@ejemplo.com"
            required
            style={authInputStyle}
          />
        </label>

        <label style={authLabelStyle}>
          <span style={authLabelTextStyle}>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={authInputStyle}
          />
        </label>

        <button
          type="submit"
          className="btn-primary"
          disabled={login.isPending}
          style={{ width: "100%" }}
        >
          {login.isPending ? "Entrando…" : "Entrar"}
        </button>

        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          ¿No tienes cuenta?{" "}
          <Link to="/register" style={{ color: "var(--accent-blue)" }}>
            Regístrate
          </Link>
        </p>
      </form>
    </div>
  );
}
