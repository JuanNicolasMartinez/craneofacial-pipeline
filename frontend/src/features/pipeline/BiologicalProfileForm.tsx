import { useState } from "react";
import { useUpdateBiologicalProfile } from "../../api/hooks/useMesh";
import type { BiologicalProfileCreate } from "../../api/types";

interface BiologicalProfileFormProps {
  caseId: string;
  onSaved: () => void;
}

const SEX_OPTIONS = [{ value: "M", label: "Masculino" }, { value: "F", label: "Femenino" }];
const ANCESTRY_OPTIONS = [
  { value: "global", label: "Global" },
  { value: "latinoamerican", label: "Latinoamericana" },
  { value: "turkish", label: "Turca" },
  { value: "korean", label: "Coreana" },
  { value: "caucasian", label: "Caucásica" },
];
const AGE_OPTIONS = [
  { value: "18-35", label: "18–35 años" },
  { value: "35-50", label: "35–50 años" },
  { value: "50+", label: "50+ años" },
  { value: "unknown", label: "Desconocida" },
];

export function BiologicalProfileForm({ caseId, onSaved }: BiologicalProfileFormProps) {
  const [sex, setSex] = useState<"M" | "F">("M");
  const [ancestry, setAncestry] = useState("global");
  const [ageRange, setAgeRange] = useState("18-35");
  const [confidence, setConfidence] = useState(0.8);
  const updateProfile = useUpdateBiologicalProfile(caseId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile.mutateAsync({
      sex, ancestry, age_range: ageRange, confidence,
    } as BiologicalProfileCreate);
    onSaved();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", padding: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>
          Perfil biológico
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Determina la tabla FSTT aplicada en el pipeline
        </p>
      </div>

      {/* Sex */}
      <Field label="Sexo estimado">
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          {SEX_OPTIONS.map((o) => (
            <PillOption key={o.value} label={o.label} active={sex === o.value} onClick={() => setSex(o.value as "M" | "F")} />
          ))}
        </div>
      </Field>

      {/* Ancestry */}
      <Field label="Ancestría estimada">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {ANCESTRY_OPTIONS.map((o) => (
            <PillOption key={o.value} label={o.label} active={ancestry === o.value} onClick={() => setAncestry(o.value)} />
          ))}
        </div>
      </Field>

      {/* Age */}
      <Field label="Rango etario estimado">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
          {AGE_OPTIONS.map((o) => (
            <PillOption key={o.value} label={o.label} active={ageRange === o.value} onClick={() => setAgeRange(o.value)} />
          ))}
        </div>
      </Field>

      {/* Confidence */}
      <Field label={`Confianza del operador: ${Math.round(confidence * 100)}%`}>
        <input
          type="range" min={0} max={1} step={0.05} value={confidence}
          onChange={(e) => setConfidence(parseFloat(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent-blue)" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Baja</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Alta</span>
        </div>
      </Field>

      {/* FSTT table preview */}
      <div style={{
        padding: "var(--space-3) var(--space-4)",
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-subtle)",
      }}>
        <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Tabla FSTT seleccionada</p>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--accent-blue)", marginTop: 2 }}>
          {ancestry === "latinoamerican" ? "Moritsugui-2022" : "T-Table-Global-2023"}
        </p>
      </div>

      <button
        type="submit"
        className="btn-primary"
        style={{ width: "100%" }}
        disabled={updateProfile.isPending}
      >
        {updateProfile.isPending ? "Guardando…" : "Guardar perfil y continuar →"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <label style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}

function PillOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "var(--space-2) var(--space-4)",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${active ? "var(--accent-blue)" : "var(--border-subtle)"}`,
        background: active ? "rgba(183,214,223,0.15)" : "var(--bg-card)",
        color: active ? "var(--accent-blue)" : "var(--text-secondary)",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        transition: "all 120ms",
      }}
    >
      {label}
    </button>
  );
}
