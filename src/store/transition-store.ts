import { create } from 'zustand';

interface TransitionState {
  isActive: boolean;
  trigger: () => void;
  reset: () => void;
}

export const useTransitionStore = create<TransitionState>((set) => ({
  isActive: false,
  trigger: () => set({ isActive: true }),
  reset: () => set({ isActive: false }),
}));
