import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

interface MeshViewerProps {
  meshUrl?: string;
  children?: React.ReactNode;
}

export function MeshViewer({ children }: MeshViewerProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "var(--bg-surface)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={1} />
        <Suspense fallback={null}>
          {children}
        </Suspense>
        <OrbitControls makeDefault />
        <Grid infiniteGrid fadeDistance={30} cellColor="var(--border-subtle)" />
      </Canvas>
    </div>
  );
}
