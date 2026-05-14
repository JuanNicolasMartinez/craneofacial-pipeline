// Hand-written types as placeholder until `pnpm generate-types` can run against a live API.
// Once the backend is up, run: pnpm generate-types
// and switch imports to src/api/types.generated.ts

export interface CaseCreate {
  case_ref: string;
  notes?: string;
  created_by: string;
}

export interface CaseRead {
  id: string;
  case_ref: string;
  status: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CaseList {
  id: string;
  case_ref: string;
  status: string;
  created_by: string;
  created_at: string;
}

export interface LandmarkIn {
  label: string;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface LandmarkSetCreate {
  operator: string;
  landmarks: LandmarkIn[];
}

export interface MeshRead {
  id: string;
  case_id: string;
  storage_url: string;
  format: string;
  file_size_bytes: number | null;
  vertex_count: number | null;
  created_at: string;
}

export interface BiologicalProfileCreate {
  sex: "M" | "F";
  ancestry: "global" | "latinoamerican" | "turkish" | "korean" | "caucasian";
  age_range: "18-35" | "35-50" | "50+" | "unknown";
  confidence: number;
}

export interface BiologicalProfileRead {
  id: string;
  case_id: string;
  sex: "M" | "F";
  ancestry: string;
  age_range: string;
  confidence: number;
  created_at: string;
}

export interface LandmarkSetRead {
  id: string;
  case_id: string;
  operator: string;
  landmark_count: number;
  created_at: string;
}

export interface PipelineRunRequest {
  landmark_set_id: string;
  fstt_k_factor?: number;
}

export interface PipelineRunResponse {
  job_id: string;
  status: string;
}

export interface JobStepRead {
  id: string;
  step_number: number;
  name: string;
  status: string;
  duration_ms: number | null;
  completed_at: string | null;
}

export interface PipelineJobRead {
  id: string;
  case_id: string;
  status: string;
  fstt_table: string;
  fstt_k_factor: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  steps: JobStepRead[];
}

export interface ResultRead {
  job_id: string;
  mesh_url: string;
  params_url: string;
  p2p_error_mm: number | null;
  hausdorff_mm: number | null;
}

export interface JobProgressMessage {
  step: number;
  status: "running" | "done" | "error";
  duration_ms?: number;
  error?: string;
}
