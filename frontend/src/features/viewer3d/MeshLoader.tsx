import { useLoader } from "@react-three/fiber";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

interface MeshLoaderProps {
  url: string;
  format: "ply" | "obj";
}

export function MeshLoader({ url, format }: MeshLoaderProps) {
  if (format === "ply") {
    return <PLYMesh url={url} />;
  }
  return <OBJMesh url={url} />;
}

function PLYMesh({ url }: { url: string }) {
  const geometry = useLoader(PLYLoader, url);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#B7D6DF" wireframe={false} />
    </mesh>
  );
}

function OBJMesh({ url }: { url: string }) {
  const obj = useLoader(OBJLoader, url);
  return <primitive object={obj} />;
}
