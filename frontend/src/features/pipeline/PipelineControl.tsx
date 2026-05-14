import { useJobStore } from "../../store/jobStore";
import { useRunPipeline } from "../../api/hooks/usePipeline";
import { useJobSocket } from "./useJobSocket";
import { StepProgress } from "./StepProgress";

interface PipelineControlProps {
  caseId: string;
  landmarkSetId: string | null;
}

export function PipelineControl({ caseId, landmarkSetId }: PipelineControlProps) {
  const { activeJobId, setActiveJobId } = useJobStore();
  const runPipeline = useRunPipeline(caseId);

  useJobSocket(activeJobId);

  const handleRun = async () => {
    if (!landmarkSetId) return;
    const result = await runPipeline.mutateAsync({
      landmark_set_id: landmarkSetId,
      fstt_k_factor: 0.0,
    });
    setActiveJobId(result.job_id);
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-6)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
          Pipeline
        </span>
        <button
          className="btn-primary"
          onClick={handleRun}
          disabled={!landmarkSetId || runPipeline.isPending}
        >
          {runPipeline.isPending ? "Starting…" : "Run pipeline"}
        </button>
      </div>

      {activeJobId && (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
            Job {activeJobId.slice(0, 8)}…
          </p>
          <StepProgress />
        </div>
      )}
    </div>
  );
}
