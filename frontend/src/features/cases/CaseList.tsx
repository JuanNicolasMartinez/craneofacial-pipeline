import { useState } from "react";
import { Plus } from "lucide-react";
import { useCases } from "../../api/hooks/useCases";
import { useJobStore } from "../../store/jobStore";
import { CaseCard } from "./CaseCard";
import { CreateCaseModal } from "./CreateCaseModal";

export function CaseList() {
  const { data: cases, isLoading } = useCases();
  const { activeCaseId, setActiveCaseId } = useJobStore();
  const [showModal, setShowModal] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}>
          Cases
        </span>
        <button className="btn-icon" onClick={() => setShowModal(true)} title="New case">
          <Plus size={18} />
        </button>
      </div>

      {isLoading && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading…</p>
      )}

      {cases?.map((c) => (
        <CaseCard
          key={c.id}
          case_={c}
          isActive={c.id === activeCaseId}
          onClick={() => setActiveCaseId(c.id)}
        />
      ))}

      {cases?.length === 0 && !isLoading && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No cases yet. Create one to get started.
        </p>
      )}

      {showModal && (
        <CreateCaseModal
          onClose={() => setShowModal(false)}
          onCreated={(id) => setActiveCaseId(id)}
        />
      )}
    </div>
  );
}
