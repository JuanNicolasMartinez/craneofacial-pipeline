import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Skull } from "lucide-react";
import { useRegister } from "../api/hooks/useAuth";
import { apiErrorMessage } from "../api/errors";
import {
  authPageStyle,
  authCardStyle,
  authInputStyle,
  authLabelStyle,
  authLabelTextStyle,
  authErrorStyle,
} from "./authStyles";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useRegister();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    try {
      await register.mutateAsync({ full_name: fullName, email, password });
      navigate("/app", { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, "No se pudo crear la cuenta"));
    }
  };

  return (
    <div style={authPageStyle}>
      <form onSubmit={handleSubmit} style={authCardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Skull size={22} style={{ color: "var(--accent-blue)" }} />
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
            Crear cuenta
          </h2>
        </div>

        {error && <div style={authErrorStyle}>{error}</div>}

        <label style={authLabelStyle}>
          <span style={authLabelTextStyle}>Nombre completo</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nombre del analista"
            required
            maxLength={100}
            style={authInputStyle}
          />
        </label>

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
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            style={authInputStyle}
          />
        </label>

        <button
          type="submit"
          className="btn-primary"
          disabled={register.isPending}
          style={{ width: "100%" }}
        >
          {register.isPending ? "Creando…" : "Crear cuenta"}
        </button>

        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" style={{ color: "var(--accent-blue)" }}>
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
