import { useState, useCallback } from "react";
import { Suspense } from "react";
import { TopNavigation } from "./TopNavigation";
import { CaseList } from "../features/cases/CaseList";
import { MeshViewer } from "../features/viewer3d/MeshViewer";
import { MeshWithRaycast } from "../features/viewer3d/MeshWithRaycast";
import { LandmarkSpheres } from "../features/viewer3d/LandmarkSpheres";
import { MeshUpload } from "../features/mesh/MeshUpload";
import { LandmarkPanel } from "../features/landmarks/LandmarkPanel";
import { BiologicalProfileForm } from "../features/pipeline/BiologicalProfileForm";
import { PipelineControl } from "../features/pipeline/PipelineControl";
import { RHINE_CAMPBELL_LANDMARKS } from "../features/landmarks/constants";
import { useJobStore, type CaseStep } from "../store/jobStore";

type Theme = "dark" | "light" | "purple";

const STEPS: { id: CaseStep; label: string }[] = [
  { id: "mesh",      label: "1. Malla" },
  { id: "landmarks", label: "2. Landmarks" },
  { id: "pipeline",  label: "3. Pipeline" },
  { id: "result",    label: "4. Resultado" },
];

export function AppShell() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [activeLandmarkIndex, setActiveLandmarkIndex] = useState(0);
  const [hasBioProfile, setHasBioProfile] = useState(false);
  const [showBioForm, setShowBioForm] = useState(false);

  const {
    activeCaseId, activeCaseRef, activeStep, setActiveStep,
    activeMeshUrl, activeMeshFormat,
    activeLandmarkSetId, addLandmark,
  } = useJobStore();

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  };

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
      setShowBioForm(true);
    },
    []
  );

  const handleBioProfileSaved = useCallback(() => {
    setHasBioProfile(true);
    setShowBioForm(false);
    setActiveStep("pipeline");
  }, [setActiveStep]);

  const handlePipelineCompleted = useCallback(() => {
    setActiveStep("result");
  }, [setActiveStep]);

  const isLandmarkMode = activeStep === "landmarks" && !!activeMeshUrl;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100%", overflow: "hidden", background: "var(--bg-page)" }}>
      <TopNavigation theme={theme} onThemeChange={handleThemeChange} />

      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: activeCaseId ? "280px minmax(0,1fr) 300px" : "280px minmax(0,1fr)",
        gap: "var(--space-4)",
        padding: "0 var(--space-4) var(--space-4)",
        minHeight: 0,
        overflow: "hidden",
      }}>

        {/* Left — case list */}
        <div style={{
          background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)", overflowY: "auto",
          padding: "var(--space-5)",
        }}>
          <CaseList />
        </div>

        {/* Center — 3D viewer */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}>

          {/* Step sub-nav — only when a case is active */}
          {activeCaseId && (
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: "var(--space-2)" }}>
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
          )}

          {/* Viewer area */}
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <MeshViewer landmarkMode={isLandmarkMode} onMeshClick={handleMeshClick}>
              {activeMeshUrl && activeMeshFormat && (
                <Suspense fallback={null}>
                  <MeshWithRaycast
                    url={activeMeshUrl}
                    format={activeMeshFormat}
                    landmarkMode={isLandmarkMode}
                    onMeshClick={handleMeshClick}
                  />
                  {isLandmarkMode && <LandmarkSpheres activeLandmarkIndex={activeLandmarkIndex} />}
                </Suspense>
              )}
            </MeshViewer>

            {/* Viewer overlay when no case selected */}
            {!activeCaseId && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: "var(--space-3)", pointerEvents: "none",
              }}>
                <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                  Selecciona o crea un caso para comenzar
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — context-sensitive */}
        {activeCaseId && (
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
              <div style={{ flex: 1, height: "100%" }}>
                {showBioForm ? (
                  <div style={{
                    background: "var(--bg-surface)", borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-subtle)", height: "100%", overflowY: "auto",
                  }}>
                    <BiologicalProfileForm caseId={activeCaseId} onSaved={handleBioProfileSaved} />
                  </div>
                ) : (
                  <LandmarkPanel
                    caseId={activeCaseId}
                    activeLandmarkIndex={activeLandmarkIndex}
                    onSelectIndex={setActiveLandmarkIndex}
                    onSaved={handleLandmarksSaved}
                  />
                )}
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
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--accent-green)" }}>
                  ✓ Reconstrucción completada
                </h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  La malla facial reconstruida está lista para exportar.
                </p>
                {activeMeshUrl ? (
                  <a
                    href={activeMeshUrl}
                    download={`${activeCaseRef ?? "resultado"}.${activeMeshFormat ?? "ply"}`}
                    className="btn-primary"
                    style={{ width: "100%", textDecoration: "none", justifyContent: "center" }}
                  >
                    Descargar resultado.{activeMeshFormat ?? "ply"}
                  </a>
                ) : (
                  <button className="btn-primary" style={{ width: "100%", opacity: 0.4 }} disabled>
                    Descargar resultado.ply
                  </button>
                )}
                <button
                  className="btn-secondary"
                  style={{ width: "100%" }}
                  onClick={() => {
                    const params = {
                      case_ref: activeCaseRef,
                      case_id: activeCaseId,
                      mesh_format: activeMeshFormat,
                      generated_at: new Date().toISOString(),
                    };
                    const blob = new Blob([JSON.stringify(params, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${activeCaseRef ?? "params"}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Descargar params.json
                </button>
              </div>
            )}
          </div>
        )}
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
