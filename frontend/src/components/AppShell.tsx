import { useState } from "react";
import { TopNavigation } from "./TopNavigation";
import { CaseList } from "../features/cases/CaseList";
import { MeshViewer } from "../features/viewer3d/MeshViewer";
import { PipelineControl } from "../features/pipeline/PipelineControl";
import { useJobStore } from "../store/jobStore";

type Theme = "dark" | "light" | "purple";

export function AppShell() {
  const [theme, setTheme] = useState<Theme>("dark");
  const { activeCaseId } = useJobStore();

  const handleThemeChange = (t: Theme) => {
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-page)",
      }}
    >
      <TopNavigation theme={theme} onThemeChange={handleThemeChange} />

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "320px 1fr 320px",
          gap: "var(--space-4)",
          padding: "0 var(--space-4) var(--space-4)",
          minHeight: 0,
        }}
      >
        {/* Left panel — case list */}
        <div
          style={{
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-lg)",
            padding: "var(--space-5)",
            border: "1px solid var(--border-subtle)",
            overflowY: "auto",
          }}
        >
          <CaseList />
        </div>

        {/* Center — 3D viewer */}
        <MeshViewer>
          {/* MeshLoader will be wired here once a case has a mesh */}
        </MeshViewer>

        {/* Right panel — pipeline control */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
            overflowY: "auto",
          }}
        >
          {activeCaseId ? (
            <PipelineControl
              caseId={activeCaseId}
              landmarkSetId={null}
            />
          ) : (
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-6)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              Select a case to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
