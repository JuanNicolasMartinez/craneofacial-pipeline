import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Sun, Moon, Sparkles, LogOut, Settings } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useLogout } from "../api/hooks/useAuth";
import type { Theme } from "../hooks/useTheme";

interface UserMenuProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "Oscuro" },
  { id: "light", label: "Claro" },
  { id: "purple", label: "Púrpura" },
];

/**
 * Dropdown anchored to the top navigation. Holds user identity, the theme
 * switcher (moved here from TopNavigation), profile access and logout.
 */
export function UserMenu({ theme, onThemeChange }: UserMenuProps) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout.mutateAsync();
    navigate("/", { replace: true });
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        className="btn-icon"
        onClick={() => setOpen((v) => !v)}
        title="Cuenta"
        style={{
          background: open ? "var(--bg-elevated)" : undefined,
          color: open ? "var(--accent-blue)" : undefined,
        }}
      >
        <User size={16} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + var(--space-2))",
            right: 0,
            width: 240,
            background: "var(--bg-card)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            zIndex: 200,
            boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          }}
        >
          {/* Identity */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: "var(--space-2)",
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.full_name ?? "Usuario"}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email ?? ""}
            </span>
          </div>

          <div style={{ height: 1, background: "var(--border-subtle)" }} />

          {/* Theme switcher */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: 0.4,
                padding: "0 var(--space-2)",
              }}
            >
              Tema
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onThemeChange(t.id)}
                  title={t.label}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "var(--space-2)",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${
                      theme === t.id ? "var(--accent-blue)" : "var(--border-subtle)"
                    }`,
                    background:
                      theme === t.id ? "var(--bg-elevated)" : "var(--bg-surface)",
                    color:
                      theme === t.id ? "var(--accent-blue)" : "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "all 120ms",
                    fontSize: 11,
                  }}
                >
                  {t.id === "dark" && <Moon size={14} />}
                  {t.id === "light" && <Sun size={14} />}
                  {t.id === "purple" && <Sparkles size={14} />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 1, background: "var(--border-subtle)" }} />

          {/* Actions */}
          <button
            onClick={() => {
              setOpen(false);
              navigate("/app/profile");
            }}
            style={menuItemStyle}
          >
            <Settings size={15} />
            Perfil y ajustes
          </button>
          <button
            onClick={handleLogout}
            disabled={logout.isPending}
            style={{ ...menuItemStyle, color: "var(--accent-red)" }}
          >
            <LogOut size={15} />
            {logout.isPending ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </div>
      )}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  padding: "var(--space-2)",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
};
