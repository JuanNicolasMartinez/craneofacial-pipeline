import { useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { useCases } from "../../api/hooks/useCases";
import { useJobStore } from "../../store/jobStore";
import { CaseCard } from "./CaseCard";
import { CreateCaseModal } from "./CreateCaseModal";

export function CaseList() {
  const { data: cases, isLoading } = useCases();
  const { activeCaseId, selectCase } = useJobStore();
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
          Casos forenses
        </span>
        <button className="btn-icon" onClick={() => setShowModal(true)} title="Nuevo caso">
          <Plus size={18} />
        </button>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 72, borderRadius: "var(--radius-md)",
              background: "var(--bg-card-soft)",
              animation: "pulse-skeleton 1.2s ease-in-out infinite",
              opacity: 0.7,
            }} />
          ))}
        </div>
      )}

      {cases?.map((c) => (
        <CaseCard
          key={c.id}
          case_={c}
          isActive={c.id === activeCaseId}
          onClick={() => selectCase({ id: c.id, ref: c.case_ref, status: c.status })}
        />
      ))}

      {cases?.length === 0 && !isLoading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", paddingTop: "var(--space-10)" }}>
          <FolderOpen size={40} style={{ color: "var(--text-muted)" }} />
          <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
            Sin casos. Crea el primero.
          </p>
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Nuevo caso
          </button>
        </div>
      )}

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
