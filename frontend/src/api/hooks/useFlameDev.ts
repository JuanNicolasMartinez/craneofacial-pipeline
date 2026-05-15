import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { FlameMappingRead } from "../types";

export function useFlameMappingDev(enabled = true) {
  return useQuery<FlameMappingRead>({
    queryKey: ["dev", "flame-mapping"],
    queryFn: async () => {
      const { data } = await apiClient.get("/dev/flame/mapping");
      return data;
    },
    enabled,
  });
}
