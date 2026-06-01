import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (a: { user?: User; accessToken: string; refreshToken: string }) => void;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: ({ user, accessToken, refreshToken }) =>
        set((s) => ({
          user: user ?? s.user,
          accessToken,
          refreshToken,
        })),
      setUser: (user) => set({ user }),
      setAccessToken: (accessToken) => set({ accessToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: "taskflow-auth" }
  )
);

/** True once the persisted auth state has been read from localStorage.
 * Starts `false` so server prerender never touches the persist API. */
export function useAuthHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    if (useAuthStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}
