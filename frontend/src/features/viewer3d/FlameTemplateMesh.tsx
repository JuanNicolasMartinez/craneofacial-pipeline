import { useCallback, useRef } from "react";
import { useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import * as THREE from "three";

export interface FlameVertexPick {
  index: number;
  x: number;
  y: number;
  z: number;
}

interface FlameTemplateMeshProps {
  url: string;
  onVertexPick?: (pick: FlameVertexPick) => void;
}

export function FlameTemplateMesh({ url, onVertexPick }: FlameTemplateMeshProps) {
  const geometry = useLoader(PLYLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const handlePointerDown = useCallback((event: ThreeEvent<PointerEvent>) => {
    pointerDown.current = { x: event.clientX, y: event.clientY };
  }, []);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!onVertexPick || !meshRef.current) return;
      if (pointerDown.current) {
        const dx = event.clientX - pointerDown.current.x;
        const dy = event.clientY - pointerDown.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }

      const positions = geometry.attributes.position;
      if (!positions) return;

      const localPoint = meshRef.current.worldToLocal(event.point.clone());
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let index = 0; index < positions.count; index += 1) {
        const vx = positions.getX(index);
        const vy = positions.getY(index);
        const vz = positions.getZ(index);
        const dx = vx - localPoint.x;
        const dy = vy - localPoint.y;
        const dz = vz - localPoint.z;
        const distance = dx * dx + dy * dy + dz * dz;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }

      if (bestIndex < 0) return;

      const localVertex = new THREE.Vector3(
        positions.getX(bestIndex),
        positions.getY(bestIndex),
        positions.getZ(bestIndex),
      );
      const worldVertex = meshRef.current.localToWorld(localVertex.clone());
      onVertexPick({
        index: bestIndex,
        x: worldVertex.x,
        y: worldVertex.y,
        z: worldVertex.z,
      });
    },
    [geometry.attributes.position, onVertexPick],
  );

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[Math.PI, 0, 0]}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <meshStandardMaterial
        color="#B6BABC"
        roughness={0.65}
        metalness={0.15}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
