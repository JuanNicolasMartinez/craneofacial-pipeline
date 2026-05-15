import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  RotateCcw, ZoomIn, ZoomOut,
  Box, MoveHorizontal, MoveVertical, ArrowUpFromLine, ArrowDownFromLine,
  Circle,
} from "lucide-react";
import { applyView, fitCameraToBounds, type CameraApi, type ViewPreset } from "./cameraApi";
import { useJobStore } from "../../store/jobStore";

// Minimal shape of OrbitControls we touch — avoids depending on three-stdlib types.
type OrbitLike = {
  target: THREE.Vector3;
  update: () => void;
};

/**
 * Lives INSIDE <Canvas>. Reads the active camera + OrbitControls handle and
 * wires them into the shared cameraApi so external HTML buttons can drive them.
 */
export function CameraApiBinder({ apiRef }: { apiRef: MutableRefObject<CameraApi> }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitLike | null;
  const initialPos = useRef<[number, number, number] | null>(null);

  useEffect(() => {
    if (!initialPos.current) {
      initialPos.current = [camera.position.x, camera.position.y, camera.position.z];
    }

    apiRef.current = {
      setView: (preset: ViewPreset) => {
        const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
        applyView(camera, target, preset);
        controls?.update();
      },
      fitBounds: (bounds, preset = "front") => {
        const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
        fitCameraToBounds(camera, target, bounds, preset);
        controls?.update();
      },
      reset: () => {
        const [x, y, z] = initialPos.current ?? [0, 80, 250];
        camera.position.set(x, y, z);
        controls?.target.set(0, 0, 0);
        controls?.update();
      },
      zoom: (delta: number) => {
        const target = controls?.target ?? new THREE.Vector3(0, 0, 0);
        const dir = camera.position.clone().sub(target).normalize();
        camera.position.addScaledVector(dir, delta);
        controls?.update();
      },
    };
  }, [camera, controls, apiRef]);

  return null;
}

interface CameraControlsProps {
  apiRef: MutableRefObject<CameraApi>;
  gridVisible: boolean;
  onToggleGrid: () => void;
}

/**
 * Floating HUD over the canvas. Pure HTML (not Three.js) so it composes
 * predictably with the rest of the UI.
 */
export function CameraControls({ apiRef, gridVisible, onToggleGrid }: CameraControlsProps) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "var(--space-4)",
        right: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        zIndex: 5,
      }}
    >
      {/* View presets */}
      <Group>
        <IconBtn title="Vista frontal (1)" onClick={() => apiRef.current.setView("front")}>
          <Box size={16} />
        </IconBtn>
        <IconBtn title="Perfil derecho (3)" onClick={() => apiRef.current.setView("right")}>
          <MoveHorizontal size={16} />
        </IconBtn>
        <IconBtn title="Perfil izquierdo" onClick={() => apiRef.current.setView("left")}>
          <MoveHorizontal size={16} style={{ transform: "scaleX(-1)" }} />
        </IconBtn>
        <IconBtn title="Vista superior (7)" onClick={() => apiRef.current.setView("top")}>
          <ArrowDownFromLine size={16} />
        </IconBtn>
        <IconBtn title="Vista inferior" onClick={() => apiRef.current.setView("bottom")}>
          <ArrowUpFromLine size={16} />
        </IconBtn>
        <IconBtn title="Isométrica" onClick={() => apiRef.current.setView("iso")}>
          <MoveVertical size={16} style={{ transform: "rotate(45deg)" }} />
        </IconBtn>
      </Group>

      {/* Landmark size slider */}
      <LandmarkSizeControl />

      {/* Zoom + reset + grid */}
      <Group>
        <IconBtn title="Acercar" onClick={() => apiRef.current.zoom(-30)}>
          <ZoomIn size={16} />
        </IconBtn>
        <IconBtn title="Alejar" onClick={() => apiRef.current.zoom(30)}>
          <ZoomOut size={16} />
        </IconBtn>
        <IconBtn title="Reset cámara (R)" onClick={() => apiRef.current.reset()}>
          <RotateCcw size={16} />
        </IconBtn>
        <IconBtn title={gridVisible ? "Ocultar grilla (G)" : "Mostrar grilla (G)"} onClick={onToggleGrid} active={gridVisible}>
          <span style={{ fontSize: 11, fontWeight: 600 }}>#</span>
        </IconBtn>
      </Group>
    </div>
  );
}

function LandmarkSizeControl() {
  const value = useJobStore((s) => s.landmarkSize);
  const setValue = useJobStore((s) => s.setLandmarkSize);
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-2)",
        padding: "var(--space-1) var(--space-2)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-pill)",
        backdropFilter: "blur(8px)",
        transition: "all 180ms",
      }}
      title="Tamaño de landmarks"
    >
      <Circle size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
      {expanded ? (
        <>
          <input
            type="range"
            min={0.05}
            max={3}
            step={0.05}
            value={value}
            onChange={(e) => setValue(parseFloat(e.target.value))}
            style={{ width: 120, accentColor: "var(--accent-blue)" }}
          />
          <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>
            {value.toFixed(value < 0.1 ? 2 : 1)}×
          </span>
        </>
      ) : (
        <span style={{ fontSize: 10, color: "var(--text-muted)", minWidth: 28, textAlign: "right" }}>
          {value.toFixed(value < 0.1 ? 2 : 1)}×
        </span>
      )}
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--space-1)",
        padding: "var(--space-1)",
        background: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-pill)",
        backdropFilter: "blur(8px)",
      }}
    >
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        background: active ? "var(--accent-blue)" : "transparent",
        color: active ? "var(--bg-main)" : "var(--text-secondary)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 120ms",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-elevated)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
