import { useCallback, useState } from "react";
import { Upload, FileCheck, AlertCircle } from "lucide-react";
import { useUploadMesh } from "../../api/hooks/useMesh";
import { useJobStore } from "../../store/jobStore";
import { apiErrorMessage } from "../../api/errors";

const ACCEPTED = [".ply", ".obj", ".stl"];
const MAX_MB = 50;

/**
 * Filtro del selector de archivos.
 *
 * Los móviles no resuelven extensiones sueltas en `accept`. iOS solo entiende
 * MIME types y UTIs, y Android filtra por MIME: una extensión que no saben
 * mapear se trata como no permitida y el archivo sale atenuado. Ni `.ply` ni
 * `.stl` tienen MIME registrado que reconozcan, así que los bloqueaban; `.obj`
 * pasaba porque iOS sí lo mapea a `model/obj`.
 *
 * Se añaden los MIME types junto a las extensiones para las plataformas que
 * los entienden. Como ninguno cubre .ply ni .stl en todas, va un comodín
 * final: el filtro deja de estorbar y la validación de verdad la hace
 * `handleFile`, que comprueba la extensión de todos modos en cualquier
 * dispositivo.
 */
const ACCEPT_ATTR = [
  ...ACCEPTED,
  "model/stl",
  "model/obj",
  "application/octet-stream",
  "*/*",
].join(",");

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
        setError(
          `"${file.name}" no es una malla válida. Usa un archivo ${ACCEPTED.join(", ")}.`,
        );
        return;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`El archivo supera el límite de ${MAX_MB} MB`);
        return;
      }
      // Un archivo que todavía vive en la nube (iCloud, OneDrive, Drive) y no
      // se ha descargado llega con tamaño 0: subirlo daría un caso vacío sin
      // explicar por qué. Pasa en móvil y en escritorio por igual.
      if (file.size === 0) {
        setError(
          "El archivo está vacío. Si está en la nube (iCloud, OneDrive, Drive), " +
            "ábrelo primero para descargarlo al dispositivo e inténtalo de nuevo.",
        );
        return;
      }
      setFileName(file.name);
      try {
        const result = await upload.mutateAsync(file);
        // Backend persists the mesh in storage; the GET /cases/{id} re-fetch will
        // populate activeMeshUrl with a backend URL. For instant preview we still
        // show a local object URL until the next hydration cycle replaces it.
        const objectUrl = URL.createObjectURL(file);
        setActiveMesh(objectUrl, result.format as "ply" | "obj" | "stl");
        onUploaded();
      } catch (err) {
        // Sin esto la promesa quedaba sin capturar y la interfaz no decía nada:
        // el usuario elegía el archivo y no pasaba absolutamente nada visible.
        setFileName(null);
        setError(apiErrorMessage(err, "No se pudo subir la malla"));
      }
    },
    [upload, setActiveMesh, onUploaded]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      // Al arrastrar una carpeta el navegador entrega una entrada sin tipo ni
      // tamaño: sin avisar, la subida fallaba con un error opaco del backend.
      if (file && file.type === "" && file.size === 0) {
        setError("Eso parece una carpeta. Arrastra el archivo de malla directamente.");
        return;
      }
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Se limpia el value para que volver a elegir el MISMO archivo dispare
    // `change` otra vez. Sin esto, tras un fallo el reintento con el mismo
    // archivo no hace nada: el navegador no emite el evento si el valor no
    // cambia. Afecta a todos los navegadores, no solo a iOS.
    e.target.value = "";
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
          padding: "clamp(var(--space-5), 8vw, var(--space-10)) var(--space-4)",
          borderRadius: "var(--radius-lg)",
          minWidth: 0,
          border: `2px dashed ${dragging ? "var(--accent-blue)" : "var(--border-medium)"}`,
          background: dragging ? "rgba(183,214,223,0.05)" : "var(--bg-surface)",
          cursor: uploading ? "wait" : "pointer",
          transition: "all 180ms ease",
        }}
      >
        <input
          type="file"
          accept={ACCEPT_ATTR}
          style={{ display: "none" }}
          onChange={onInputChange}
          disabled={uploading}
        />

        {uploading ? (
          <>
            <div style={spinnerStyle} />
            <span style={{
              fontSize: 14,
              color: "var(--text-secondary)",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              Subiendo {fileName}…
            </span>
          </>
        ) : fileName && upload.isSuccess ? (
          <>
            <FileCheck size={40} style={{ color: "var(--accent-green)" }} />
            <span style={{
              fontSize: 14,
              color: "var(--accent-green)",
              fontWeight: 500,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
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
          display: "flex", alignItems: "flex-start", gap: "var(--space-2)",
          padding: "var(--space-3) var(--space-4)",
          background: "rgba(239,89,78,0.1)",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(239,89,78,0.3)",
        }}>
          <AlertCircle size={16} style={{ color: "var(--accent-red)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: "var(--accent-red)", minWidth: 0 }}>{error}</span>
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
