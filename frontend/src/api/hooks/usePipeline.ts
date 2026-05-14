import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { PipelineRunRequest, PipelineRunResponse, ResultRead } from "../types";

export function useRunPipeline(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<PipelineRunResponse, Error, PipelineRunRequest>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post(
        `/cases/${caseId}/pipeline/run`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
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
