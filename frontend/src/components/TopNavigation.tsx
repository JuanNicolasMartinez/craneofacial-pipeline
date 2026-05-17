import { Skull } from "lucide-react";
import { UserMenu } from "./UserMenu";
import type { Theme } from "../hooks/useTheme";

interface TopNavigationProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function TopNavigation({ theme, onThemeChange }: TopNavigationProps) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-3) var(--space-6)",
        background: "var(--bg-card)",
        borderRadius: "var(--radius-pill)",
        border: "1px solid var(--border-subtle)",
        margin: "var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <Skull size={20} style={{ color: "var(--accent-blue)" }} />
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
          Craneofacial Pipeline
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-pill)",
            padding: "2px 8px",
          }}
        >
          {/* NeuroMinds · UBPD */}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {import.meta.env.DEV && (
          <button
            className="btn-secondary"
            onClick={() => {
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.set("dev", "flame-mapping");
              window.location.href = nextUrl.toString();
            }}
            style={{ height: 44, padding: "0 var(--space-4)", fontSize: 12 }}
            title="Abrir herramienta local de calibración FLAME"
          >
            FLAME Map
          </button>
        )}
        <UserMenu theme={theme} onThemeChange={onThemeChange} />
      </div>
    </nav>
  );
}
