import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { useJobStore } from "../../store/jobStore";
import { useRunPipeline } from "../../api/hooks/usePipeline";
import { useJobSocket } from "./useJobSocket";

const STEP_LABELS: Record<number, string> = {
  1: "Ingesta del cráneo",
  2: "Preprocesamiento geométrico",
  3: "Landmarks",
  4: "Perfil biológico",
  5: "Vectores FSTT",
  6: "Malla FLAME base",
  7: "Alineación cráneo–cara",
  8: "Deformación TPS",
  9: "Exportación",
};

const MANUAL_STEPS = new Set([3, 4]);

interface PipelineControlProps {
  caseId: string;
  landmarkSetId: string | null;
  hasBioProfile: boolean;
  onCompleted: () => void;
}

export function PipelineControl({
  caseId,
  landmarkSetId,
  hasBioProfile,
  onCompleted,
}: PipelineControlProps) {
  const {
    activeJobId,
    setActiveJobId,
    stepProgress,
    resetJobProgress,
  } = useJobStore();
  const runPipeline = useRunPipeline(caseId);
  const [kFactor, setKFactor] = useState(0.0);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  useJobSocket(activeJobId);

  useEffect(() => {
    if (!activeJobId || !startTime) return;
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, [activeJobId, startTime]);

  useEffect(() => {
    if (stepProgress[9]?.status === "done") onCompleted();
  }, [stepProgress, onCompleted]);

  const stepEntries = Object.values(stepProgress);
  const failedStep =
    [...stepEntries]
      .filter((step) => step.status === "error")
      .sort((left, right) => right.step - left.step)[0] ?? null;
  const isCompleted = stepProgress[9]?.status === "done";
  const isRunning = !!activeJobId;
  const hasProgress = stepEntries.length > 0;
  const hasError = !!failedStep;
  const showTimeline = isRunning || hasProgress;
  const canRun = !!landmarkSetId && hasBioProfile && !activeJobId;

  const handleRun = async () => {
    if (!landmarkSetId || activeJobId) return;
    resetJobProgress();
    const result = await runPipeline.mutateAsync({
      landmark_set_id: landmarkSetId,
      fstt_k_factor: kFactor,
    });
    setActiveJobId(result.job_id);
    setStartTime(Date.now());
    setElapsed(0);
  };

  const formatTime = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  const progressTitle = isRunning
    ? "Pipeline en ejecución"
    : hasError
      ? "Pipeline con error"
      : isCompleted
        ? "Pipeline completado"
        : "Última ejecución";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        height: "100%",
      }}
    >
      {!showTimeline && (
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
          }}
        >
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Configuración
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {[
              { label: "Malla del cráneo", ok: true },
              { label: "Landmarks (21 puntos)", ok: !!landmarkSetId },
              { label: "Perfil biológico", ok: hasBioProfile },
            ].map(({ label, ok }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: ok ? "var(--accent-green)" : "var(--bg-card)",
                    border: ok ? "none" : "1px solid var(--border-medium)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ok && <Check size={9} color="#050607" strokeWidth={3} />}
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: ok ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <label
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                fontWeight: 500,
              }}
            >
              Ajuste exploratorio FSTT (k)
            </label>
            <input
              type="range"
              min={-1.5}
              max={1.5}
              step={0.5}
              value={kFactor}
              onChange={(event) => setKFactor(parseFloat(event.target.value))}
              style={{ width: "100%", accentColor: "var(--accent-blue)" }}
            />
            <div style={{ display: "flex", justifyContent: "center" }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                  background: "var(--bg-elevated)",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 12px",
                }}
              >
                {kFactor > 0 ? `+${kFactor}` : kFactor} —{" "}
                {kFactor === 0
                  ? "Grosor medio (recomendado)"
                  : kFactor > 0
                    ? `Tejido más grueso (+${kFactor})`
                    : `Tejido más delgado (${kFactor})`}
              </span>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ width: "100%", height: 48, fontSize: 15, opacity: canRun ? 1 : 0.5 }}
            disabled={!canRun || runPipeline.isPending}
            onClick={handleRun}
            title={!canRun ? "Completa los landmarks y el perfil biológico primero" : undefined}
          >
            {runPipeline.isPending ? "Iniciando…" : "Reconstruir cráneo →"}
          </button>

          {!canRun && (
            <p
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: -8,
              }}
            >
              {!landmarkSetId ? "Falta guardar los landmarks" : "Falta el perfil biológico"}
            </p>
          )}
        </div>
      )}

      {showTimeline && (
        <div
          style={{
            flex: 1,
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border-subtle)",
            padding: "var(--space-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: hasError ? "var(--accent-red)" : "var(--text-primary)",
                }}
              >
                {progressTitle}
              </h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {isRunning ? formatTime(elapsed) : hasError ? "El job se detuvo antes de exportar el resultado." : "La ejecuci&#243;n termin&#243; correctamente."}
              </p>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                left: 13,
                top: 14,
                bottom: 14,
                width: 2,
                background: "var(--border-subtle)",
              }}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {Array.from({ length: 9 }, (_, index) => index + 1).map((step) => {
                const progress = stepProgress[step];
                const isManual = MANUAL_STEPS.has(step);
                const isDone = progress?.status === "done" || isManual;
                const isStepRunning = progress?.status === "running";
                const isStepError = progress?.status === "error";

                return (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      height: 48,
                      position: "relative",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: isStepError
                          ? "var(--accent-red)"
                          : isDone
                            ? "var(--accent-green)"
                            : isStepRunning
                              ? "var(--accent-blue)"
                              : "var(--bg-card)",
                        border:
                          !isDone && !isStepRunning && !isStepError
                            ? "1px solid var(--border-medium)"
                            : "none",
                        animation: isStepRunning ? "spin 1s linear infinite" : "none",
                      }}
                    >
                      {isDone && <Check size={12} color="#050607" strokeWidth={3} />}
                      {isStepError && <X size={12} color="white" strokeWidth={3} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: isStepRunning ? 500 : 400,
                          color: isStepError
                            ? "var(--accent-red)"
                            : isDone
                              ? "var(--text-primary)"
                              : isStepRunning
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                        }}
                      >
                        {STEP_LABELS[step]}
                      </span>
                      {isManual && (
                        <span
                          style={{
                            marginLeft: "var(--space-2)",
                            fontSize: 10,
                            color: "var(--text-muted)",
                            background: "var(--bg-card)",
                            borderRadius: "var(--radius-pill)",
                            padding: "1px 6px",
                            verticalAlign: "middle",
                          }}
                        >
                          manual
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        minWidth: 40,
                        textAlign: "right",
                      }}
                    >
                      {isDone && progress?.duration_ms ? `${(progress.duration_ms / 1000).toFixed(1)}s` : ""}
                      {isStepRunning && <span style={{ color: "var(--accent-blue)" }}>···</span>}
                      {isStepError && <span style={{ color: "var(--accent-red)" }}>Error</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {hasError && (
            <div
              style={{
                background: "rgba(203, 91, 68, 0.08)",
                border: "1px solid rgba(203, 91, 68, 0.28)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-3)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-red)" }}>
                  Falló en {STEP_LABELS[failedStep.step]}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {failedStep.error ?? "El backend detuvo la reconstrucci&#243;n por geometr&#237;a inv&#225;lida."}
                </span>
              </div>

              <button
                className="btn-primary"
                style={{ width: "100%" }}
                disabled={!canRun || runPipeline.isPending}
                onClick={handleRun}
              >
                {runPipeline.isPending ? "Reintentando…" : "Reintentar pipeline"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
