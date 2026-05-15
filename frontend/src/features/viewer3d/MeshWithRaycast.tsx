import { useRef, useCallback, useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

interface MeshWithRaycastProps {
  url: string;
  format: "ply" | "obj" | "stl";
  landmarkMode?: boolean;
  rotation?: [number, number, number];
  onMeshClick?: (p: { x: number; y: number; z: number; nx: number; ny: number; nz: number }) => void;
  onBoundsReady?: (bounds: { min: [number, number, number]; max: [number, number, number] }) => void;
}

export function MeshWithRaycast(props: MeshWithRaycastProps) {
  const { url, format, rotation = [Math.PI, 0, 0] } = props;
  if (format === "ply") return <PLYMesh {...props} rotation={rotation} />;
  return <OBJMesh url={url} />;
}

function PLYMesh({
  url,
  landmarkMode,
  rotation = [Math.PI, 0, 0],
  onMeshClick,
  onBoundsReady,
}: Omit<MeshWithRaycastProps, "format">) {
  const loadedGeometry = useLoader(PLYLoader, url);
  const geometry = useMemo(() => loadedGeometry.clone(), [loadedGeometry]);
  const meshRef = useRef<THREE.Mesh>(null);
  const pointerDown = useRef<{ x: number; y: number } | null>(null);

  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  useEffect(() => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    if (meshRef.current) {
      meshRef.current.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(meshRef.current);
      onBoundsReady?.({
        min: [box.min.x, box.min.y, box.min.z],
        max: [box.max.x, box.max.y, box.max.z],
      });
    }
  }, [geometry, onBoundsReady]);

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
      rotation={rotation}
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
