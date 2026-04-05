import { create } from 'zustand';
import type { User } from '@/types/database';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionTimeout: number;
  setUser: (user: User | null) => void;
  setUserIfChanged: (partial: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setSessionTimeout: (minutes: number) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  sessionTimeout: 30,
  // isLoading'i burada false yapmıyoruz — yalnızca setLoading() ile kontrol edilir.
  // setUser çağrısından sonra refreshFromDB() tamamlanana kadar loading true kalmalı.
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setUserIfChanged: (partial) => {
    const current = get().user;
    if (!current) return;
    const hasChanges = (Object.keys(partial) as (keyof User)[]).some(
      (key) => partial[key] !== current[key],
    );
    if (!hasChanges) return;
    set({ user: { ...current, ...partial } });
  },
  setLoading: (isLoading) => set({ isLoading }),
  setSessionTimeout: (sessionTimeout) => set({ sessionTimeout }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
