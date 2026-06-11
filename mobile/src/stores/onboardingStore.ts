import { create } from 'zustand';

interface OnboardingState {
  /**
   * Tri-state:
   * - null  → SecureStore not yet read (initial)
   * - true  → user has completed or skipped onboarding
   * - false → user has not seen onboarding yet
   */
  seen: boolean | null;
  setSeen: (seen: boolean) => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  seen: null,
  setSeen: (seen) => set({ seen }),
}));
