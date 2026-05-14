import type { CaseList } from "../../api/types";

const STATUS_COLORS: Record<string, string> = {
  created:          "var(--text-muted)",
  landmarks_ready:  "var(--accent-blue)",
  running:          "var(--accent-lime)",
  completed:        "var(--accent-green)",
  error:            "var(--accent-red)",
};

interface CaseCardProps {
  case_: CaseList;
  isActive: boolean;
  onClick: () => void;
}

export function CaseCard({ case_, isActive, onClick }: CaseCardProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: isActive ? "var(--bg-elevated)" : "var(--bg-card)",
        border: `1px solid ${isActive ? "var(--border-medium)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-md)",
        padding: "var(--space-4) var(--space-5)",
        cursor: "pointer",
        transition: "all 180ms ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
          {case_.case_ref}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: STATUS_COLORS[case_.status] ?? "var(--text-muted)",
            background: "var(--bg-card-soft)",
            borderRadius: "var(--radius-pill)",
            padding: "2px 10px",
          }}
        >
          {case_.status}
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
        {case_.created_by} · {new Date(case_.created_at).toLocaleDateString()}
      </p>
    </button>
  );
}
