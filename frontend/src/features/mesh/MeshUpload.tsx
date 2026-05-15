import { useCallback, useState } from "react";
import { Upload, FileCheck, AlertCircle } from "lucide-react";
import { useUploadMesh } from "../../api/hooks/useMesh";
import { useJobStore } from "../../store/jobStore";

const ACCEPTED = [".ply", ".obj", ".stl"];
const MAX_MB = 50;

interface MeshUploadProps {
  caseId: string;
  onUploaded: () => void;
}

export function MeshUpload({ caseId, onUploaded }: MeshUploadProps) {
  const upload = useUploadMesh(caseId);
  const setActiveMesh = useJobStore((s) => s.setActiveMesh);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED.includes(`.${ext}`)) {
        setError(`Formato no soportado. Usa: ${ACCEPTED.join(", ")}`);
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`El archivo supera el límite de ${MAX_MB} MB`);
        return;
      }
      setFileName(file.name);
      const result = await upload.mutateAsync(file);
      // Backend persists the mesh in storage; the GET /cases/{id} re-fetch will
      // populate activeMeshUrl with a backend URL. For instant preview we still
      // show a local object URL until the next hydration cycle replaces it.
      const objectUrl = URL.createObjectURL(file);
      setActiveMesh(objectUrl, result.format as "ply" | "obj" | "stl");
      onUploaded();
    },
    [upload, setActiveMesh, onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const uploading = upload.isPending;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)", padding: "var(--space-6)" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)", marginBottom: "var(--space-1)" }}>
          Subir malla del cráneo
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Formatos aceptados: .ply · .obj · .stl · Máximo {MAX_MB} MB
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-4)",
          padding: "var(--space-10)",
          borderRadius: "var(--radius-lg)",
          border: `2px dashed ${dragging ? "var(--accent-blue)" : "var(--border-medium)"}`,
          background: dragging ? "rgba(183,214,223,0.05)" : "var(--bg-surface)",
          cursor: uploading ? "wait" : "pointer",
          transition: "all 180ms ease",
        }}
      >
        <input
          type="file"
          accept={ACCEPTED.join(",")}
          style={{ display: "none" }}
          onChange={onInputChange}
          disabled={uploading}
        />

        {uploading ? (
          <>
            <div style={spinnerStyle} />
            <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>
              Subiendo {fileName}…
            </span>
          </>
        ) : fileName && upload.isSuccess ? (
          <>
            <FileCheck size={40} style={{ color: "var(--accent-green)" }} />
            <span style={{ fontSize: 14, color: "var(--accent-green)", fontWeight: 500 }}>
              {fileName} subido correctamente
            </span>
          </>
        ) : (
          <>
            <Upload size={40} style={{ color: "var(--text-muted)" }} />
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
                Arrastra el archivo aquí
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                o haz clic para seleccionar
              </p>
            </div>
          </>
        )}
      </label>

      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(239,89,78,0.1)",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(239,89,78,0.3)",
        }}>
          <AlertCircle size={16} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--accent-red)" }}>{error}</span>
        </div>
      )}
    </div>
  );
}

const spinnerStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "3px solid var(--border-medium)",
  borderTopColor: "var(--accent-blue)",
  animation: "spin 0.8s linear infinite",
};
