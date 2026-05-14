import { useState } from "react";
import { useCreateCase } from "../../api/hooks/useCases";

interface CreateCaseModalProps {
  onClose: () => void;
  onCreated: (id: string, ref: string) => void;
}

export function CreateCaseModal({ onClose, onCreated }: CreateCaseModalProps) {
  const [caseRef, setCaseRef] = useState("");
  const [notes, setNotes] = useState("");
  const [operator, setOperator] = useState("");
  const createCase = useCreateCase();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await createCase.mutateAsync({
      case_ref: caseRef,
      notes: notes || undefined,
      created_by: operator,
    });
    onCreated(result.id, result.case_ref);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-8)",
          width: 400,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
          border: "1px solid var(--border-medium)",
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
          Nuevo caso forense
        </h2>

        {[
          { label: "Referencia del caso", value: caseRef, setter: setCaseRef, placeholder: "CASO-2025-084", required: true },
          { label: "Operador", value: operator, setter: setOperator, placeholder: "Nombre del analista", required: true },
          { label: "Notas", value: notes, setter: setNotes, placeholder: "Observaciones opcionales", required: false },
        ].map(({ label, value, setter, placeholder, required }) => (
          <label key={label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
            <input
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              required={required}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-3) var(--space-4)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
          </label>
        ))}

        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={createCase.isPending}>
            {createCase.isPending ? "Creando…" : "Crear caso"}
          </button>
        </div>
      </form>
    </div>
  );
}
