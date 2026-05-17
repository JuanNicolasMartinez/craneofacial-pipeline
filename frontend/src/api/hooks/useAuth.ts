import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import { useAuthStore } from "../../store/authStore";
import type { User, UserLogin, UserRegister } from "../types";

const ME_KEY = ["auth", "me"];

/**
 * Resolves the current session by calling GET /auth/me. A 401 simply means
 * "not logged in" — handled as `data: null`, not an error, so it never retries.
 */
export function useCurrentUser() {
  const setUser = useAuthStore((s) => s.setUser);

  const query = useQuery<User | null>({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        const { data } = await apiClient.get<User>("/auth/me");
        return data;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (query.data !== undefined) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, UserLogin>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<User>("/auth/login", payload);
      return data;
    },
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(ME_KEY, user);
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation<User, Error, UserRegister>({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post<User>("/auth/register", payload);
      return data;
    },
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(ME_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const clearUser = useAuthStore((s) => s.clearUser);
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await apiClient.post("/auth/logout");
    },
    onSuccess: () => {
      clearUser();
      // Drop every cached query — they belonged to the previous session.
      queryClient.clear();
    },
  });
}
