import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

interface MeshViewerProps {
  landmarkMode?: boolean;
  onMeshClick?: (point: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) => void;
  children?: React.ReactNode;
}

export function MeshViewer({ landmarkMode = false, children }: MeshViewerProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
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

        <Suspense fallback={null}>
          {children}
        </Suspense>

        {/* OrbitControls always active — right-click/middle for orbit, left-click handled by mesh for landmarks */}
        <OrbitControls
          makeDefault
          mouseButtons={{ LEFT: 0, MIDDLE: 1, RIGHT: 2 }}
        />

        <Grid
          infiniteGrid
          fadeDistance={500}
          cellSize={10}
          sectionSize={50}
          cellColor="#1D2023"
          sectionColor="#24272B"
        />
      </Canvas>
    </div>
  );
}
