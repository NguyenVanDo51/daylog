import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CaptureState {
  lastCaptureAt: number | null;
  setLastCaptureAt: (ts: number) => void;
}

export const useCaptureStore = create<CaptureState>()(
  persist(
    (set) => ({
      lastCaptureAt: null,
      setLastCaptureAt: (ts) => set({ lastCaptureAt: ts }),
    }),
    {
      name: 'capture-store',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export const CAPTURE_COOLDOWN_MS = 30 * 60 * 1000;

export function getCooldownRemaining(lastCaptureAt: number | null): number {
  if (!lastCaptureAt) return 0;
  const elapsed = Date.now() - lastCaptureAt;
  return Math.max(0, CAPTURE_COOLDOWN_MS - elapsed);
}
