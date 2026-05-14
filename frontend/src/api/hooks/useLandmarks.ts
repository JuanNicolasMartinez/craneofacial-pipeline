import { useMutation, useQueryClient } from "@tanstack/react-query";
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
    },
  });
}
