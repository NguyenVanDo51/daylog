import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PendingCaptureAsset {
  type: 'photo' | 'video';
  uri: string;
  durationMs?: number;
}

interface CaptureState {
  lastCaptureAt: number | null;
  pendingAsset: PendingCaptureAsset | null;
  setLastCaptureAt: (ts: number) => void;
  setPendingAsset: (asset: PendingCaptureAsset) => void;
  clearPendingAsset: () => void;
}

export const useCaptureStore = create<CaptureState>()(
  persist(
    (set) => ({
      lastCaptureAt: null,
      pendingAsset: null,
      setLastCaptureAt: (ts) => set({ lastCaptureAt: ts }),
      setPendingAsset: (asset) => set({ pendingAsset: asset }),
      clearPendingAsset: () => set({ pendingAsset: null }),
    }),
    {
      name: 'capture-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lastCaptureAt: state.lastCaptureAt }),
    }
  )
);

export const CAPTURE_COOLDOWN_MS = 30 * 60 * 1000;

export function getCooldownRemaining(lastCaptureAt: number | null): number {
  if (!lastCaptureAt) return 0;
  const elapsed = Date.now() - lastCaptureAt;
  return Math.max(0, CAPTURE_COOLDOWN_MS - elapsed);
}
