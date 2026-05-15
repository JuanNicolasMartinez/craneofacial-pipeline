import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { useJobStore } from "../../store/jobStore";
import type { CaseCreate, CaseList, CaseRead } from "../types";
import { useCaseLandmarks } from "./useLandmarks";

export function useCases() {
  return useQuery<CaseList[]>({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data } = await apiClient.get("/cases");
      return data;
    },
    refetchInterval: (query) => {
      // Poll while any case is running, stop once all are settled
      const cases = query.state.data;
      if (cases?.some((c) => c.status === "running")) return 3000;
      return false;
    },
  });
}

export function useCase(caseId: string | null) {
  return useQuery<CaseRead>({
    queryKey: ["cases", caseId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}`);
      return data;
    },
    enabled: !!caseId,
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();
  return useMutation<CaseRead, Error, CaseCreate>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post("/cases", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
  });
}

/**
 * Side-effect hook: when activeCaseId changes, fetch the full case + its
 * landmarks and push hydration into the Zustand store so the user lands
 * exactly where they left off.
 */
export function useCaseHydration(caseId: string | null) {
  const caseQuery = useCase(caseId);
  const landmarksQuery = useCaseLandmarks(caseId);
  const applyHydration = useJobStore((s) => s.applyHydration);
  const activeJobId = useJobStore((s) => s.activeJobId);

  useEffect(() => {
    if (!caseQuery.data) return;
    if (landmarksQuery.isLoading) return;

    // While a job is actively running (set by PipelineControl after POST /run),
    // skip re-hydration so polling doesn't overwrite activeJobId with stale data.
    if (activeJobId) return;

    const c = caseQuery.data;
    const lmSet = landmarksQuery.data;
    applyHydration({
      currentStep: c.current_step,
      meshUrl: c.mesh_url,
      meshFormat: c.mesh_format,
      landmarkSetId: c.landmark_set_id,
      landmarks: lmSet?.landmarks ?? [],
      hasBioProfile: c.has_biological_profile,
      lastJobId: c.last_job_id,
      lastJobStatus: c.last_job_status,
    });
  }, [caseQuery.data, landmarksQuery.data, landmarksQuery.isLoading, applyHydration, activeJobId]);

  return { case: caseQuery.data, isLoading: caseQuery.isLoading };
}
