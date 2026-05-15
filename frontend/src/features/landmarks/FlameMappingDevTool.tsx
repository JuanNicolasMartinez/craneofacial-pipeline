import { Suspense, useEffect, useState } from "react";
import { Copy, Download, ArrowLeft, Check } from "lucide-react";
import { MeshViewer } from "../viewer3d/MeshViewer";
import {
  FlameTemplateMesh,
  type FlameVertexPick,
} from "../viewer3d/FlameTemplateMesh";
import { RHINE_CAMPBELL_LANDMARKS } from "./constants";
import { useFlameMappingDev } from "../../api/hooks/useFlameDev";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function FlameMappingDevTool() {
  const mappingQuery = useFlameMappingDev(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [draftMapping, setDraftMapping] = useState<Record<string, number>>({});
  const [pickedVertex, setPickedVertex] = useState<FlameVertexPick | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "done">("idle");

  useEffect(() => {
    if (!mappingQuery.data) return;
    setDraftMapping(mappingQuery.data.mapping);
  }, [mappingQuery.data]);

  const currentDefinition = RHINE_CAMPBELL_LANDMARKS[activeIndex];
  const currentLabel = currentDefinition?.label ?? null;
  const currentMapping = currentLabel ? draftMapping[currentLabel] : undefined;
  const assignedCount = mappingQuery.data
    ? mappingQuery.data.landmark_order.filter((label) => draftMapping[label] !== undefined).length
    : 0;
  const templateUrl = `${API_URL}/dev/flame/template.ply`;
  const exportPayload = JSON.stringify(
    {
      flame_template: mappingQuery.data?.flame_template ?? "generic_model.pkl",
      landmark_order: mappingQuery.data?.landmark_order ?? RHINE_CAMPBELL_LANDMARKS.map((item) => item.label),
      rigid_landmark_labels: mappingQuery.data?.rigid_landmark_labels ?? [],
      mapping: draftMapping,
    },
    null,
    2,
  );

  const handleAssign = () => {
    if (!currentLabel || !pickedVertex) return;
    setDraftMapping((prev) => ({ ...prev, [currentLabel]: pickedVertex.index }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportPayload);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("idle");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "flame_landmark_mapping.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (mappingQuery.isLoading) {
    return (
      <div style={{ padding: "var(--space-8)", color: "var(--text-primary)" }}>
        Cargando template FLAME…
      </div>
    );
  }

  if (mappingQuery.isError || !mappingQuery.data || !currentDefinition) {
    return (
      <div style={{ padding: "var(--space-8)", color: "var(--accent-red)" }}>
        No se pudo cargar la herramienta de calibración FLAME.
      </div>
    );
  }

  const rigidSet = new Set(mappingQuery.data.rigid_landmark_labels);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 360px",
        gap: "var(--space-4)",
        height: "100vh",
        padding: "var(--space-4)",
        background: "var(--bg-page)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <button
            className="btn-secondary"
            style={{ height: 32, padding: "0 var(--space-3)", fontSize: 12 }}
            onClick={() => {
              const nextUrl = new URL(window.location.href);
              nextUrl.searchParams.delete("dev");
              window.location.href = nextUrl.toString();
            }}
          >
            <ArrowLeft size={14} /> Volver
          </button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
            Calibraci&#243;n FLAME
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px",
            }}
          >
            Solo desarrollo
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0 }}>
          <MeshViewer landmarkMode resetViewKey="flame-dev">
            <Suspense fallback={null}>
              <FlameTemplateMesh url={templateUrl} onVertexPick={setPickedVertex} />
              {pickedVertex && (
                <mesh position={[pickedVertex.x, pickedVertex.y, pickedVertex.z]}>
                  <sphereGeometry args={[1.8, 16, 16]} />
                  <meshStandardMaterial color="#B7D6DF" emissive="#B7D6DF" emissiveIntensity={0.35} />
                </mesh>
              )}
            </Suspense>
          </MeshViewer>
        </div>
      </div>

      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-subtle)",
          padding: "var(--space-6)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {assignedCount} / {mappingQuery.data.landmark_order.length} labels asignados
          </span>
          <div
            style={{
              height: 8,
              borderRadius: "var(--radius-pill)",
              background: "var(--bg-card)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(assignedCount / mappingQuery.data.landmark_order.length) * 100}%`,
                height: "100%",
                background: "var(--accent-blue)",
              }}
            />
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Label {activeIndex + 1} / {RHINE_CAMPBELL_LANDMARKS.length}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {currentDefinition.label}
            </span>
            {rigidSet.has(currentDefinition.label) && (
              <span
                style={{
                  fontSize: 10,
                  color: "var(--accent-green)",
                  background: "rgba(145, 194, 86, 0.12)",
                  borderRadius: "var(--radius-pill)",
                  padding: "2px 8px",
                }}
              >
                Rigid subset
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {currentDefinition.description}
          </p>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Vertex actual: {currentMapping ?? "sin asignar"}
          </span>
          <span style={{ fontSize: 12, color: pickedVertex ? "var(--accent-blue)" : "var(--text-muted)" }}>
            {pickedVertex ? `Pick actual: ${pickedVertex.index}` : "Haz clic sobre la malla para elegir un v&#233;rtice"}
          </span>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          >
            Anterior
          </button>
          <button
            className="btn-secondary"
            style={{ flex: 1 }}
            onClick={() => setActiveIndex((index) => Math.min(RHINE_CAMPBELL_LANDMARKS.length - 1, index + 1))}
          >
            Siguiente
          </button>
        </div>

        <button className="btn-primary" style={{ width: "100%" }} onClick={handleAssign} disabled={!pickedVertex}>
          Asignar {currentDefinition.label}
        </button>

        <button
          className="btn-secondary"
          style={{ width: "100%" }}
          onClick={() => {
            if (!currentLabel) return;
            setDraftMapping((prev) => {
              const next = { ...prev };
              delete next[currentLabel];
              return next;
            });
          }}
        >
          Limpiar label actual
        </button>

        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={handleCopy}>
            <Copy size={14} /> {copyState === "done" ? "Copiado" : "Copiar JSON"}
          </button>
          <button className="btn-secondary" style={{ flex: 1 }} onClick={handleDownload}>
            <Download size={14} /> Descargar
          </button>
        </div>

        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            padding: "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Mapping actual
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {RHINE_CAMPBELL_LANDMARKS.map((item, index) => {
              const mapped = draftMapping[item.label];
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.label}
                  onClick={() => setActiveIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-2)",
                    borderRadius: "var(--radius-md)",
                    border: `1px solid ${isActive ? "var(--accent-blue)" : "var(--border-subtle)"}`,
                    background: isActive ? "rgba(183,214,223,0.08)" : "transparent",
                    padding: "var(--space-2) var(--space-3)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{index + 1}</span>
                    <span style={{ fontSize: 12 }}>{item.label}</span>
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    {mapped !== undefined && <Check size={13} color="var(--accent-green)" />}
                    <span style={{ fontSize: 12, color: mapped !== undefined ? "var(--text-primary)" : "var(--text-muted)" }}>
                      {mapped ?? "—"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
