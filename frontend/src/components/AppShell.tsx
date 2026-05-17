import { useState, useCallback, useEffect } from "react";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { TopNavigation } from "./TopNavigation";
import { WelcomeScreen } from "./WelcomeScreen";
import { MeshViewer } from "../features/viewer3d/MeshViewer";
import { MeshWithRaycast } from "../features/viewer3d/MeshWithRaycast";
import { LandmarkSpheres } from "../features/viewer3d/LandmarkSpheres";
import { MeshUpload } from "../features/mesh/MeshUpload";
import { LandmarkPanel } from "../features/landmarks/LandmarkPanel";
import { FlameMappingDevTool } from "../features/landmarks/FlameMappingDevTool";
import { BiologicalProfileForm } from "../features/pipeline/BiologicalProfileForm";
import { PipelineControl } from "../features/pipeline/PipelineControl";
import { RHINE_CAMPBELL_LANDMARKS } from "../features/landmarks/constants";
import { useJobStore, type CaseStep } from "../store/jobStore";
import { useCaseHydration } from "../api/hooks/useCases";
import { useCaseResult } from "../api/hooks/usePipeline";
import { useTheme } from "../hooks/useTheme";

type BoundsPayload = { min: [number, number, number]; max: [number, number, number] };

const RESULT_MESH_ROTATION: [number, number, number] = [Math.PI, 0, 0];

const STEPS: { id: CaseStep; label: string }[] = [
  { id: "mesh",                label: "1. Malla" },
  { id: "landmarks",           label: "2. Landmarks" },
  { id: "biological_profile",  label: "3. Perfil" },
  { id: "pipeline",            label: "4. Pipeline" },
  { id: "result",              label: "5. Resultado" },
];

function formatFsttProfile(profile: Record<string, unknown> | null) {
  if (!profile) return "—";
  return [profile.sex, profile.age_range, profile.ancestry]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" · ") || "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid var(--border-subtle)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-2)",
      background: "var(--bg-surface)",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{
        fontSize: 12,
        color: "var(--text-primary)",
        fontWeight: 500,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {value}
      </div>
    </div>
  );
}

export function AppShell() {
  const isFlameMappingDev =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("dev") === "flame-mapping";
  const { theme, setTheme } = useTheme();
  const [activeLandmarkIndex, setActiveLandmarkIndex] = useState(0);
  const [resultBounds, setResultBounds] = useState<BoundsPayload | null>(null);

  const {
    activeCaseId, activeCaseRef, activeCaseStatus, activeStep, setActiveStep,
    activeMeshUrl, activeMeshFormat,
    activeLandmarkSetId, addLandmark,
    landmarksInProgress,
    hasBioProfile, setHasBioProfile,
    setActiveJobId,
    clearActiveCase,
  } = useJobStore();

  // Hidrata datos del caso al seleccionar (mesh URL, landmarks, profile, job)
  useCaseHydration(activeCaseId);

  // Result step: load the reconstruction URL.
  const resultQuery = useCaseResult(activeStep === "result" ? activeCaseId : null);
  const resultMeshUrl = resultQuery.data?.mesh_url ?? null;
  const hasResult = !!resultQuery.data?.mesh_url;
  const resultQuality = resultQuery.data?.quality_status ?? "ok";
  const hasQualityWarning = hasResult && resultQuality !== "ok";
  const resultConfidence =
    typeof resultQuery.data?.confidence_score === "number"
      ? resultQuery.data.confidence_score
      : null;
  const scientificBasis: Record<string, unknown> =
    resultQuery.data?.scientific_basis ?? {};
  const fsttProfile =
    scientificBasis.fstt_profile && typeof scientificBasis.fstt_profile === "object"
      ? scientificBasis.fstt_profile as Record<string, unknown>
      : null;

  // What we actually render in the 3D viewer.
  const displayMeshUrl =
    activeStep === "result" && resultQuery.data
      ? resultMeshUrl ?? activeMeshUrl
      : activeMeshUrl;
  // Reconstruction results are always PLY (see _export_result).
  const displayMeshFormat = activeStep === "result" ? "ply" : activeMeshFormat;
  const shouldShowLandmarks =
    !!displayMeshUrl &&
    activeStep !== "result" &&
    landmarksInProgress.length > 0;

  const handleMeshUploaded = useCallback(() => {
    setActiveStep("landmarks");
  }, [setActiveStep]);

  const handleMeshClick = useCallback(
    (p: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) => {
      if (activeStep !== "landmarks") return;
      const def = RHINE_CAMPBELL_LANDMARKS[activeLandmarkIndex];
      if (!def) return;
      addLandmark({ label: def.label, ...p });
      // Advance to next unplaced landmark
      const placed = useJobStore.getState().landmarksInProgress;
      const nextUnplaced = RHINE_CAMPBELL_LANDMARKS.findIndex(
        (l, i) => i > activeLandmarkIndex && !placed.find((p) => p.label === l.label)
      );
      if (nextUnplaced >= 0) setActiveLandmarkIndex(nextUnplaced);
    },
    [activeStep, activeLandmarkIndex, addLandmark]
  );

  const handleLandmarksSaved = useCallback(
    (_id: string) => {
      setActiveStep("biological_profile");
    },
    [setActiveStep]
  );

  const handleBioProfileSaved = useCallback(() => {
    setHasBioProfile(true);
    setActiveStep("pipeline");
  }, [setActiveStep, setHasBioProfile]);

  const handlePipelineCompleted = useCallback(() => {
    setActiveJobId(null);
    setActiveStep("result");
  }, [setActiveStep, setActiveJobId]);

  useEffect(() => {
    setResultBounds(null);
  }, [resultMeshUrl]);

  // Recompute the first unplaced landmark whenever the placed set changes
  useEffect(() => {
    const placed = useJobStore.getState().landmarksInProgress;
    const idx = RHINE_CAMPBELL_LANDMARKS.findIndex(
      (l) => !placed.find((p) => p.label === l.label)
    );
    setActiveLandmarkIndex(idx >= 0 ? idx : 0);
  }, [activeCaseId]);

  if (isFlameMappingDev) return <FlameMappingDevTool />;
  const isLandmarkMode = activeStep === "landmarks" && !!activeMeshUrl;

  if (!activeCaseId) return <WelcomeScreen onThemeChange={setTheme} theme={theme} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden", background: "var(--bg-page)" }}>
      <TopNavigation theme={theme} onThemeChange={setTheme} />

      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 340px",
        gap: "var(--space-4)",
        padding: "0 var(--space-4) var(--space-4)",
        minHeight: 0,
        overflow: "hidden",
      }}>

        {/* Center — 3D viewer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}>

          {/* Step sub-nav */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button
              onClick={clearActiveCase}
              className="btn-secondary"
              style={{ height: 32, padding: "0 var(--space-3)", fontSize: 12 }}
              title="Volver a la lista de casos"
            >
              <ArrowLeft size={14} /> Casos
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 var(--space-2)" }}>
              {activeCaseRef}
            </span>
            {STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(s.id)}
                style={{
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--border-subtle)",
                  background: activeStep === s.id ? "var(--bg-elevated)" : "var(--bg-card)",
                  color: activeStep === s.id ? "var(--text-primary)" : "var(--text-muted)",
                  fontSize: 13, fontWeight: activeStep === s.id ? 500 : 400,
                  cursor: "pointer", transition: "all 120ms",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Viewer area */}
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <MeshViewer
              landmarkMode={isLandmarkMode}
              onMeshClick={handleMeshClick}
              resetViewKey={activeStep === "result" ? "result" : undefined}
              focusBounds={activeStep === "result" ? resultBounds : null}
            >
              {displayMeshUrl && displayMeshFormat && (
                <Suspense fallback={null}>
                  <MeshWithRaycast
                    key={displayMeshUrl}
                    url={displayMeshUrl}
                    format={displayMeshFormat}
                    rotation={activeStep === "result" ? RESULT_MESH_ROTATION : undefined}
                    landmarkMode={isLandmarkMode}
                    onMeshClick={handleMeshClick}
                    onBoundsReady={activeStep === "result" ? setResultBounds : undefined}
                  />
                  {shouldShowLandmarks && (
                    <LandmarkSpheres
                      activeLandmarkIndex={isLandmarkMode ? activeLandmarkIndex : -1}
                    />
                  )}
                </Suspense>
              )}
            </MeshViewer>
          </div>
        </div>

        {/* Right panel — context-sensitive */}
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {activeStep === "mesh" && (
              <div style={{
                background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)", height: "100%",
              }}>
                <MeshUpload caseId={activeCaseId} onUploaded={handleMeshUploaded} />
              </div>
            )}

            {activeStep === "landmarks" && (
              <LandmarkPanel
                caseId={activeCaseId}
                activeLandmarkIndex={activeLandmarkIndex}
                onSelectIndex={setActiveLandmarkIndex}
                onSaved={handleLandmarksSaved}
              />
            )}

            {activeStep === "biological_profile" && (
              <div style={{
                background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)", height: "100%", overflowY: "auto",
              }}>
                <BiologicalProfileForm caseId={activeCaseId} onSaved={handleBioProfileSaved} />
              </div>
            )}

            {activeStep === "pipeline" && (
              <PipelineControl
                caseId={activeCaseId}
                landmarkSetId={activeLandmarkSetId}
                hasBioProfile={hasBioProfile}
                onCompleted={handlePipelineCompleted}
              />
            )}

            {activeStep === "result" && (
              <div style={{
                background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
                border: "1px solid var(--border-subtle)", padding: "var(--space-6)",
                display: "flex", flexDirection: "column", gap: "var(--space-4)",
              }}>
                <h3 style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: hasQualityWarning
                    ? "var(--accent-orange)"
                    : hasResult
                      ? "var(--accent-green)"
                      : "var(--text-primary)",
                }}>
                  {hasResult
                    ? hasQualityWarning
                      ? "Reconstrucción completada con advertencia"
                      : "✓ Reconstrucción completada"
                    : "Resultado no disponible"}
                </h3>

                {hasQualityWarning && (
                  <div style={{
                    background: "rgba(188, 113, 71, 0.10)",
                    border: "1px solid rgba(188, 113, 71, 0.32)",
                    borderRadius: "var(--radius-md)",
                    padding: "var(--space-3)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-1)",
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-orange)" }}>
                      Calidad: {resultQuality}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      {resultQuery.data?.warning_message ??
                        "Se generó una cara humana con deformación limitada porque la geometría completa era inestable."}
                    </span>
                  </div>
                )}

                {resultQuery.isLoading && (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Cargando resultado…
                  </p>
                )}

                {resultQuery.isError && (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                  }}>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      El último job del pipeline no dejó un resultado válido para mostrar.
                      {activeCaseStatus === "error"
                        ? " Vuelve a Pipeline para revisar el error y corregir los landmarks si hace falta."
                        : " Ejecuta el pipeline para generar una reconstrucción vigente."}
                    </p>
                    <button
                      className="btn-secondary"
                      style={{ width: "100%" }}
                      onClick={() => setActiveStep("pipeline")}
                    >
                      Ir a Pipeline
                    </button>
                  </div>
                )}

                {hasResult && (
                  <div style={{
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    background: "var(--bg-card)",
                    padding: "var(--space-4)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                      Base científica usada
                    </h4>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      FLAME se usó como prior humano; FSTT y landmarks se aplicaron como
                      restricciones suaves para evitar deformaciones no anatómicas.
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)", marginTop: 2 }}>
                      <Metric label="Confianza" value={resultConfidence !== null ? resultConfidence.toFixed(2) : "—"} />
                      <Metric label="Perfil" value={formatFsttProfile(fsttProfile)} />
                      <Metric label="FSTT" value="media" />
                      <Metric label="Landmarks" value="21 usados" />
                    </div>
                  </div>
                )}

                {resultMeshUrl ? (
                  <button
                    className="btn-primary"
                    style={{ width: "100%" }}
                    onClick={async () => {
                      const blob = await (await fetch(resultMeshUrl)).blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = blobUrl;
                      a.download = `${activeCaseRef ?? "resultado"}_face.ply`;
                      a.click();
                      URL.revokeObjectURL(blobUrl);
                    }}
                  >
                    Descargar resultado.ply
                  </button>
                ) : !resultQuery.isError ? (
                  <button className="btn-primary" style={{ width: "100%", opacity: 0.4 }} disabled>
                    Descargar resultado.ply
                  </button>
                ) : null}

                {resultQuery.data?.params_url && (
                  <button
                    className="btn-secondary"
                    style={{ width: "100%" }}
                    onClick={async () => {
                      const res = await fetch(resultQuery.data!.params_url);
                      const blob = await res.blob();
                      const blobUrl = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = blobUrl;
                      a.download = `${activeCaseRef ?? "params"}.json`;
                      a.click();
                      URL.revokeObjectURL(blobUrl);
                    }}
                  >
                    Descargar params.json
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(183,214,223,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(183,214,223,0); }
        }
      `}</style>
    </div>
  );
}
