import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { MeshRead, BiologicalProfileCreate, BiologicalProfileRead } from "../types";

export function useUploadMesh(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<MeshRead, Error, File>({
    mutationFn: async (file) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post(`/cases/${caseId}/mesh`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
  });
}

export function useUpdateBiologicalProfile(caseId: string) {
  const queryClient = useQueryClient();
  return useMutation<BiologicalProfileRead, Error, BiologicalProfileCreate>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.patch(`/cases/${caseId}/biological-profile`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cases", caseId] });
    },
  });
}
