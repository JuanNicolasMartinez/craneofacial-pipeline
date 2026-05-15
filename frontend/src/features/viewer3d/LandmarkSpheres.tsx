import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useJobStore } from "../../store/jobStore";
import { RHINE_CAMPBELL_LANDMARKS } from "../landmarks/constants";

interface LandmarkSpheresProps {
  activeLandmarkIndex?: number;
}

export function LandmarkSpheres({
  activeLandmarkIndex,
}: LandmarkSpheresProps) {
  const landmarks = useJobStore((s) => s.landmarksInProgress);
  const sizeFactor = useJobStore((s) => s.landmarkSize);
  const activeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (activeRef.current) {
      const s = 1 + 0.15 * Math.sin(clock.getElapsedTime() * 4);
      activeRef.current.scale.setScalar(s);
    }
  });

  const activeLabel =
    activeLandmarkIndex !== undefined && activeLandmarkIndex >= 0
      ? RHINE_CAMPBELL_LANDMARKS[activeLandmarkIndex]?.label
      : null;

  return (
    <group>
      {landmarks.map((lm) => {
        const isActive = lm.label === activeLabel;
        const radius = (isActive ? 3 : 2.5) * sizeFactor;
        return (
          <mesh
            key={lm.label}
            ref={isActive ? activeRef : undefined}
            position={[lm.x, lm.y, lm.z]}
            renderOrder={999}
          >
            <sphereGeometry args={[radius, 16, 16]} />
            <meshBasicMaterial
              color={isActive ? "#B7D6DF" : "#C9DD87"}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
