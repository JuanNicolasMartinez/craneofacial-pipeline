import { Skull, Sun, Moon, Sparkles } from "lucide-react";

type Theme = "dark" | "light" | "purple";

interface TopNavigationProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

export function TopNavigation({ theme, onThemeChange }: TopNavigationProps) {
  const themes: Theme[] = ["dark", "light", "purple"];

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
          NeuroMinds · UBPD
        </span>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        {themes.map((t) => (
          <button
            key={t}
            className="btn-icon"
            onClick={() => onThemeChange(t)}
            title={`${t} theme`}
            style={{
              background: theme === t ? "var(--bg-elevated)" : undefined,
              color: theme === t ? "var(--accent-blue)" : undefined,
            }}
          >
            {t === "dark"   && <Moon size={16} />}
            {t === "light"  && <Sun size={16} />}
            {t === "purple" && <Sparkles size={16} />}
          </button>
        ))}
      </div>
    </nav>
  );
}
