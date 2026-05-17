import { useState } from "react";
import { Plus, FolderOpen, Skull } from "lucide-react";
import { TopNavigation } from "./TopNavigation";
import { useCases } from "../api/hooks/useCases";
import { useJobStore } from "../store/jobStore";
import { CreateCaseModal } from "../features/cases/CreateCaseModal";
import type { CaseList, CaseStep } from "../api/types";
import type { Theme } from "../hooks/useTheme";

interface WelcomeScreenProps {
  theme: Theme;
  onThemeChange: (t: Theme) => void;
}

const STEP_LABEL: Record<CaseStep, string> = {
  mesh:                "1/5 · Subir malla",
  landmarks:           "2/5 · Landmarks",
  biological_profile:  "3/5 · Perfil biológico",
  pipeline:            "4/5 · Pipeline",
  result:              "5/5 · Resultado listo",
};

const STATUS_COLOR: Record<string, string> = {
  created:         "var(--text-muted)",
  landmarks_ready: "var(--accent-blue)",
  running:         "var(--accent-lime)",
  completed:       "var(--accent-green)",
  error:           "var(--accent-red)",
};

export function WelcomeScreen({ theme, onThemeChange }: WelcomeScreenProps) {
  const { data: cases, isLoading } = useCases();
  const selectCase = useJobStore((s) => s.selectCase);
  const [showModal, setShowModal] = useState(false);

  const handleSelect = (c: CaseList) => {
    selectCase({ id: c.id, ref: c.case_ref, status: c.status });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "var(--bg-page)",
      }}
    >
      <TopNavigation theme={theme} onThemeChange={onThemeChange} />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "var(--space-10) var(--space-6)",
          gap: "var(--space-8)",
        }}
      >
        {/* Hero */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", maxWidth: 640, textAlign: "center" }}>
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
          <button
            className="btn-primary"
            onClick={() => setShowModal(true)}
            style={{ marginTop: "var(--space-3)", padding: "0 var(--space-8)", height: 52, fontSize: 15 }}
          >
            <Plus size={18} />
            Nuevo caso forense
          </button>
        </div>

        {/* Recent cases */}
        <div style={{ width: "100%", maxWidth: 1100 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-4)" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.4 }}>
              Casos recientes
            </h2>
            {cases && cases.length > 0 && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {cases.length} {cases.length === 1 ? "caso" : "casos"}
              </span>
            )}
          </div>

          {isLoading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 130,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--bg-card-soft)",
                    animation: "pulse-skeleton 1.2s ease-in-out infinite",
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          )}

          {!isLoading && cases && cases.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--space-3)",
                padding: "var(--space-10) var(--space-6)",
                borderRadius: "var(--radius-lg)",
                border: "1px dashed var(--border-medium)",
                background: "var(--bg-surface)",
              }}
            >
              <FolderOpen size={40} style={{ color: "var(--text-muted)" }} />
              <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
                Sin casos todavía. Crea el primero para comenzar.
              </p>
            </div>
          )}

          {!isLoading && cases && cases.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: "var(--space-4)",
              }}
            >
              {cases.slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  style={{
                    textAlign: "left",
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-lg)",
                    padding: "var(--space-5)",
                    cursor: "pointer",
                    transition: "all 180ms ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    minHeight: 130,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--bg-elevated)";
                    e.currentTarget.style.borderColor = "var(--border-medium)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--bg-card)";
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                      {c.case_ref}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: STATUS_COLOR[c.status] ?? "var(--text-muted)",
                        background: "var(--bg-card-soft)",
                        borderRadius: "var(--radius-pill)",
                        padding: "2px 8px",
                        flexShrink: 0,
                      }}
                    >
                      {c.status}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: c.current_step === "result" ? "var(--accent-green)" : "var(--accent-blue)",
                      background: "var(--bg-surface)",
                      borderRadius: "var(--radius-pill)",
                      padding: "3px 10px",
                      alignSelf: "flex-start",
                    }}
                  >
                    {STEP_LABEL[c.current_step]}
                  </span>

                  <div style={{ marginTop: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                    {c.owner_name} · {new Date(c.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto", fontSize: 11, color: "var(--text-muted)", opacity: 0.6 }}>
          {/* NeuroMinds · UBPD · v0.1.0 */}
        </div>
      </div>

      {showModal && (
        <CreateCaseModal
          onClose={() => setShowModal(false)}
          onCreated={(id, ref) => {
            selectCase({ id, ref, status: "created" });
            setShowModal(false);
          }}
        />
      )}

      <style>{`
        @keyframes pulse-skeleton {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
