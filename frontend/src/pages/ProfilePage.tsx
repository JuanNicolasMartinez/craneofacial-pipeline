import { useNavigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { TopNavigation } from "../components/TopNavigation";
import { useAuthStore } from "../store/authStore";
import { useTheme } from "../hooks/useTheme";

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      <span
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 15, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        background: "var(--bg-page)",
      }}
    >
      <TopNavigation theme={theme} onThemeChange={setTheme} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "var(--space-8) var(--space-6)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 520 }}>
          <button
            onClick={() => navigate("/app")}
            className="btn-secondary"
            style={{
              height: 32,
              padding: "0 var(--space-3)",
              fontSize: 12,
              marginBottom: "var(--space-4)",
            }}
          >
            <ArrowLeft size={14} /> Volver
          </button>

          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-8)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-6)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "var(--bg-elevated)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <User size={22} style={{ color: "var(--accent-blue)" }} />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
                Perfil
              </h1>
            </div>

            <ProfileField label="Nombre completo" value={user?.full_name ?? "—"} />
            <ProfileField label="Correo" value={user?.email ?? "—"} />
            <ProfileField
              label="Miembro desde"
              value={
                user?.created_at
                  ? new Date(user.created_at).toLocaleDateString()
                  : "—"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
