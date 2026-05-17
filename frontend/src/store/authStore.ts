import { create } from "zustand";
import type { User } from "../api/types";

/**
 * Caches the authenticated user for the UI. The session itself lives in the
 * HttpOnly cookie issued by the backend — this store never holds the token.
 */
interface AuthStore {
  user: User | null;
  setUser: (user: User | null) => void;
  clearUser: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}));
