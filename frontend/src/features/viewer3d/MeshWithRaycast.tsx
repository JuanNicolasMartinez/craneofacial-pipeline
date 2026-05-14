import { useRef, useCallback } from "react";
import { useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

interface MeshWithRaycastProps {
  url: string;
  format: "ply" | "obj" | "stl";
  landmarkMode?: boolean;
  onMeshClick?: (p: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) => void;
}

export function MeshWithRaycast({ url, format, landmarkMode, onMeshClick }: MeshWithRaycastProps) {
  if (format === "ply") return <PLYMesh url={url} landmarkMode={landmarkMode} onMeshClick={onMeshClick} />;
  return <OBJMesh url={url} />;
}

function PLYMesh({ url, landmarkMode, onMeshClick }: Omit<MeshWithRaycastProps, "format">) {
  const geometry = useLoader(PLYLoader, url);
  const meshRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDown.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!landmarkMode || !onMeshClick) return;
      // Ignore if the pointer moved more than 5px (it's a drag, not a click)
      if (pointerDown.current) {
        const dx = e.clientX - pointerDown.current.x;
        const dy = e.clientY - pointerDown.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) return;
      }

      const face = e.face;
      if (!face) return;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld);
      const worldNormal = face.normal.clone().applyMatrix3(normalMatrix).normalize();
      const point = e.point;

      onMeshClick({
        x: point.x, y: point.y, z: point.z,
        nx: worldNormal.x, ny: worldNormal.y, nz: worldNormal.z,
      });
    },
    [landmarkMode, onMeshClick]
  );

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      rotation={[Math.PI, 0, 0]}
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

function OBJMesh({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} rotation={[Math.PI, 0, 0]} />;
}
