import { useState } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { RHINE_CAMPBELL_LANDMARKS } from "./constants";
import { useJobStore } from "../../store/jobStore";
import { useSaveLandmarks } from "../../api/hooks/useLandmarks";

interface LandmarkPanelProps {
  caseId: string;
  activeLandmarkIndex: number;
  onSelectIndex: (i: number) => void;
  onSaved: (landmarkSetId: string) => void;
}

export function LandmarkPanel({ caseId, activeLandmarkIndex, onSelectIndex, onSaved }: LandmarkPanelProps) {
  const { landmarksInProgress, removeLandmark, setActiveLandmarkSetId } = useJobStore();
  const saveLandmarks = useSaveLandmarks(caseId);
  const [showExitWarning, setShowExitWarning] = useState(false);

  const placed = landmarksInProgress.length;
  const total = RHINE_CAMPBELL_LANDMARKS.length;
  const progress = (placed / total) * 100;

  const handleSave = async () => {
    const result = await saveLandmarks.mutateAsync({
      operator: "operador",
      landmarks: landmarksInProgress,
    });
    setActiveLandmarkSetId(result.id);
    onSaved(result.id);
  };

  const handleRemove = (label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeLandmark(label);
    const idx = RHINE_CAMPBELL_LANDMARKS.findIndex((l) => l.label === label);
    if (idx >= 0) onSelectIndex(idx);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border-subtle)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "var(--space-5)", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-3)" }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Landmarks</h3>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Rhine & Campbell 1980</p>
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
            {placed} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>/ {total}</span>
          </span>
        </div>
        {/* Progress bar */}
        <div style={{ height: 4, background: "var(--bg-card)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: placed === total ? "var(--accent-green)" : "var(--accent-lime)",
            borderRadius: "var(--radius-pill)", transition: "width 200ms ease",
          }} />
        </div>
      </div>

      {/* Active landmark guide */}
      {activeLandmarkIndex < total && (
        <div style={{
          padding: "var(--space-3) var(--space-5)",
          background: "rgba(183,214,223,0.07)",
          borderBottom: "1px solid var(--border-subtle)",
        }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-blue)" }}>
            → {RHINE_CAMPBELL_LANDMARKS[activeLandmarkIndex].label.replace(/_/g, " ")}
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {RHINE_CAMPBELL_LANDMARKS[activeLandmarkIndex].description}
          </p>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-2) 0" }}>
        {RHINE_CAMPBELL_LANDMARKS.map((def, i) => {
          const placed_lm = landmarksInProgress.find((l) => l.label === def.label);
          const isActive = i === activeLandmarkIndex;
          const isDone = !!placed_lm;

          return (
            <div
              key={def.label}
              onClick={() => !isDone && onSelectIndex(i)}
              style={{
                display: "flex", alignItems: "center", gap: "var(--space-3)",
                padding: "var(--space-2) var(--space-5)",
                cursor: isDone ? "default" : "pointer",
                background: isActive ? "var(--bg-card-soft)" : "transparent",
                borderLeft: isActive ? "2px solid var(--accent-blue)" : "2px solid transparent",
                transition: "background 120ms",
              }}
            >
              {/* Indicator */}
              <div style={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isDone ? "var(--accent-lime)" : isActive ? "var(--accent-blue)" : "var(--bg-card)",
                border: isDone || isActive ? "none" : "1px solid var(--border-medium)",
                animation: isActive && !isDone ? "pulse 1.5s ease-in-out infinite" : "none",
              }}>
                {isDone && <Check size={10} color="#050607" strokeWidth={3} />}
              </div>

              {/* Label + coords */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: isDone || isActive ? 500 : 400,
                  color: isDone ? "var(--text-primary)" : isActive ? "var(--text-primary)" : "var(--text-muted)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {i + 1}. {def.label.replace(/_/g, " ")}
                </p>
                {isDone && placed_lm && (
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    {placed_lm.x.toFixed(1)} · {placed_lm.y.toFixed(1)} · {placed_lm.z.toFixed(1)}
                  </p>
                )}
              </div>

              {/* Remove button */}
              {isDone && (
                <button
                  onClick={(e) => handleRemove(def.label, e)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", fontSize: 14, padding: "0 var(--space-1)",
                    lineHeight: 1,
                  }}
                  title="Eliminar"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: "var(--space-4) var(--space-5)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex", gap: "var(--space-3)",
      }}>
        <button
          className="btn-secondary"
          style={{ flex: 1 }}
          onClick={() => useJobStore.getState().resetLandmarks()}
        >
          Limpiar
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1 }}
          disabled={placed < total || saveLandmarks.isPending}
          onClick={handleSave}
          title={placed < total ? `Faltan ${total - placed} landmarks` : undefined}
        >
          {saveLandmarks.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {showExitWarning && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
        }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: "var(--radius-lg)",
            padding: "var(--space-8)", width: 380, border: "1px solid var(--border-medium)",
          }}>
            <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
              <AlertTriangle size={20} style={{ color: "var(--accent-orange)", flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
                  ¿Salir sin guardar?
                </p>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                  Los landmarks no guardados se perderán.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button className="btn-secondary" onClick={() => setShowExitWarning(false)}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--accent-red)", color: "white" }}
                onClick={() => { setShowExitWarning(false); }}
              >
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
