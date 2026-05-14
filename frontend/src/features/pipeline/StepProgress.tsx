import { useJobStore } from "../../store/jobStore";

const STEP_LABELS: Record<number, string> = {
  1: "Ingestion",
  2: "Preprocessing",
  3: "Landmark selection",
  4: "Biological profile",
  5: "FSTT vectors",
  6: "FLAME loading",
  7: "Skull alignment",
  8: "TPS deformation",
  9: "Export",
};

export function StepProgress() {
  const stepProgress = useJobStore((s) => s.stepProgress);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      {Array.from({ length: 9 }, (_, i) => i + 1).map((step) => {
        const prog = stepProgress[step];
        const isDone = prog?.status === "done";
        const isRunning = prog?.status === "running";
        const isError = prog?.status === "error";

        let color = "var(--text-muted)";
        if (isDone) color = "var(--accent-green)";
        if (isRunning) color = "var(--accent-blue)";
        if (isError) color = "var(--accent-red)";

        return (
          <div
            key={step}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              fontSize: 14,
              color,
            }}
          >
            <span style={{ width: 20, textAlign: "right", fontWeight: 600 }}>{step}</span>
            <span>{STEP_LABELS[step]}</span>
            {isDone && prog.duration_ms && (
              <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
                {prog.duration_ms}ms
              </span>
            )}
            {isRunning && !isDone && (
              <span style={{ fontSize: 12, color: "var(--accent-blue)", marginLeft: "auto" }}>
                running…
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
