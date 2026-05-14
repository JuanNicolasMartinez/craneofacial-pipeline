import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useJobStore } from "../../store/jobStore";
import { RHINE_CAMPBELL_LANDMARKS } from "../landmarks/constants";

interface LandmarkSpheresProps {
  activeLandmarkIndex: number;
}

export function LandmarkSpheres({ activeLandmarkIndex }: LandmarkSpheresProps) {
  const landmarks = useJobStore((s) => s.landmarksInProgress);
  const activeRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (activeRef.current) {
      const s = 1 + 0.15 * Math.sin(clock.getElapsedTime() * 4);
      activeRef.current.scale.setScalar(s);
    }
  });

  const activeLabel = RHINE_CAMPBELL_LANDMARKS[activeLandmarkIndex]?.label;

  return (
    <>
      {landmarks.map((lm) => {
        const isActive = lm.label === activeLabel;
        return (
          <mesh
            key={lm.label}
            ref={isActive ? activeRef : undefined}
            position={[lm.x, lm.y, lm.z]}
            renderOrder={999}
          >
            <sphereGeometry args={[isActive ? 3 : 2.5, 16, 16]} />
            <meshBasicMaterial
              color={isActive ? "#B7D6DF" : "#C9DD87"}
              depthTest={false}
            />
          </mesh>
        );
      })}
    </>
  );
}
