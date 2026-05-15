import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { LandmarkSetCreate, LandmarkSetRead } from "../types";

export function useSaveLandmarks(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<LandmarkSetRead, Error, LandmarkSetCreate>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.patch(`/cases/${caseId}/landmarks`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
      queryClient.invalidateQueries({ queryKey: ["landmarks", caseId] });
    },
  });
}

export function useCaseLandmarks(caseId: string | null) {
  return useQuery<LandmarkSetRead | null>({
    queryKey: ["landmarks", caseId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/cases/${caseId}/landmarks`);
      return data;
    },
    enabled: !!caseId,
  });
}
