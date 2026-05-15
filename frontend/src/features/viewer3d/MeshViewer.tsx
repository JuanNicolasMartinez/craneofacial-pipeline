import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { CameraApiBinder, CameraControls } from "./CameraControls";
import { useCameraApiRef } from "./cameraApi";
import { useCameraShortcuts } from "./useCameraShortcuts";

interface MeshViewerProps {
  landmarkMode?: boolean;
  onMeshClick?: (point: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) => void;
  /** When this changes, the camera resets to "front" view. Use to re-frame after switching meshes. */
  resetViewKey?: string;
  focusBounds?: { min: [number, number, number]; max: [number, number, number] } | null;
  children?: React.ReactNode;
}

export function MeshViewer({ landmarkMode = false, resetViewKey, focusBounds, children }: MeshViewerProps) {
  const apiRef = useCameraApiRef();
  const [gridVisible, setGridVisible] = useState(true);
  const [showLandmarkHint, setShowLandmarkHint] = useState(false);

  useCameraShortcuts(apiRef, () => setGridVisible((v) => !v));

  // Show a one-shot hint when entering landmark mode
  useEffect(() => {
    if (!landmarkMode) return;
    setShowLandmarkHint(true);
    const id = setTimeout(() => setShowLandmarkHint(false), 6000);
    return () => clearTimeout(id);
  }, [landmarkMode]);

  // Auto-front view when resetViewKey changes (e.g., entering "result" step).
  useEffect(() => {
    if (resetViewKey === undefined) return;
    // Defer one frame so CameraApiBinder has populated apiRef.
    const id = requestAnimationFrame(() => {
      if (focusBounds) apiRef.current.fitBounds(focusBounds, "front");
      else apiRef.current.setView("front");
    });
    return () => cancelAnimationFrame(id);
  }, [resetViewKey, focusBounds, apiRef]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "var(--bg-main)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: "1px solid var(--border-subtle)",
        cursor: landmarkMode ? "crosshair" : "grab",
      }}
    >
      <Canvas
        camera={{ position: [0, 80, 250], fov: 45, up: [0, 1, 0] }}
        gl={{ antialias: true }}
        onPointerMissed={() => {}}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[0, 150, 100]} intensity={0.9} />
        <directionalLight position={[0, -80, 100]} intensity={0.3} />
        <hemisphereLight args={["#24272B", "#17191C", 0.3]} />

        <Suspense fallback={null}>{children}</Suspense>

        {/*
          OrbitControls — left = rotate, right = pan, scroll = dolly.
          Always enabled; MeshWithRaycast distinguishes click vs drag (5px threshold).
        */}
        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          panSpeed={0.9}
          zoomSpeed={0.9}
          rotateSpeed={0.7}
          dampingFactor={0.08}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          keyPanSpeed={20}
        />

        <CameraApiBinder apiRef={apiRef} />

        {gridVisible && (
          <Grid
            infiniteGrid
            fadeDistance={500}
            cellSize={10}
            sectionSize={50}
            cellColor="#1D2023"
            sectionColor="#24272B"
          />
        )}
      </Canvas>

      {/* HUD */}
      <CameraControls
        apiRef={apiRef}
        gridVisible={gridVisible}
        onToggleGrid={() => setGridVisible((v) => !v)}
      />

      {/* Landmark mode hint */}
      {showLandmarkHint && (
        <div
          style={{
            position: "absolute",
            top: "var(--space-4)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-medium)",
            borderRadius: "var(--radius-pill)",
            padding: "var(--space-2) var(--space-5)",
            fontSize: 12,
            color: "var(--text-secondary)",
            zIndex: 5,
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          Click izq: colocar landmark · Click der: panear · Scroll: zoom · Drag izq: orbitar
        </div>
      )}
    </div>
  );
}
