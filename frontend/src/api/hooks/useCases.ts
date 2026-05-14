import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { CaseCreate, CaseList, CaseRead } from "../types";

export function useCases() {
  return useQuery<CaseList[]>({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data } = await apiClient.get("/cases");
      return data;
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
