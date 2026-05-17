import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { PipelineRunRequest, PipelineRunResponse, ResultRead } from "../types";

export function useRunPipeline(caseId: string) {
  return useMutation<PipelineRunResponse, Error, PipelineRunRequest>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(
        `/cases/${caseId}/pipeline/run`,
        payload
      );
      return data;
    },
    // Don't invalidate here — the WebSocket streams progress in real-time.
    // An immediate refetch races with setActiveJobId and resets activeJobId to null
    // (job is still "pending" in DB when the 202 response arrives).
    onSuccess: () => {},
  });
}

export function useCaseResult(caseId: string | null) {
  return useQuery<ResultRead>({
    queryKey: ["result", caseId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/result`);
      return data;
    },
    enabled: !!caseId,
  });
}
