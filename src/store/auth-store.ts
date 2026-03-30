import { create } from 'zustand';
import type { User } from '@/types/database';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  // isLoading'i burada false yapmıyoruz — yalnızca setLoading() ile kontrol edilir.
  // setUser çağrısından sonra refreshFromDB() tamamlanana kadar loading true kalmalı.
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false }),
}));
