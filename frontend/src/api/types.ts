// Hand-written types as placeholder until `pnpm generate-types` can run against a live API.
// Once the backend is up, run: pnpm generate-types
// and switch imports to src/api/types.generated.ts

export interface User {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface UserRegister {
  email: string;
  full_name: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface CaseCreate {
  case_ref: string;
  notes?: string;
}

export type CaseStep = "mesh" | "landmarks" | "biological_profile" | "pipeline" | "result";

export interface CaseRead {
  id: string;
  case_ref: string;
  status: string;
  notes: string | null;
  owner_name: string;
  created_at: string;
  updated_at: string;
  // Hydration / checkpoint
  current_step: CaseStep;
  mesh_id: string | null;
  mesh_url: string | null;
  mesh_format: "ply" | "obj" | "stl" | null;
  landmark_set_id: string | null;
  landmark_count: number;
  has_biological_profile: boolean;
  last_job_id: string | null;
  last_job_status: string | null;
}

export interface CaseList {
  id: string;
  case_ref: string;
  status: string;
  owner_name: string;
  created_at: string;
  current_step: CaseStep;
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
  protocol: string;
  mean_inter_operator_dist_mm: number | null;
  created_at: string;
  landmarks: (LandmarkIn & { id: string; set_id: string })[];
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
  mesh_url_alt: string | null;
  params_url: string;
  quality_status?: "ok" | "degraded" | "fallback" | string | null;
  warning_message?: string | null;
  confidence_score?: number | null;
  scientific_basis?: Record<string, unknown> | null;
  diagnostics_summary?: Record<string, unknown> | null;
  p2p_error_mm: number | null;
  hausdorff_mm: number | null;
}

export interface FlameMappingRead {
  flame_template: string;
  landmark_order: string[];
  rigid_landmark_labels: string[];
  mapping: Record<string, number>;
  template_vertex_count: number;
  template_face_count: number;
}

export interface JobProgressMessage {
  step: number;
  status: "running" | "done" | "error";
  duration_ms?: number;
  error?: string;
  vertex_count?: number;
  face_count?: number;
  quality_status?: string | null;
  warning_message?: string | null;
}
