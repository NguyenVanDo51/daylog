import { create } from 'zustand';

export interface ReviewAsset {
  uri: string;
  type: 'photo' | 'video';
  source: 'camera' | 'gallery';
  durationMs?: number;
  takenAt?: string | null;
  localAssetId?: string;
}

interface PhotoReviewState {
  assets: ReviewAsset[];
  setAssets: (assets: ReviewAsset[]) => void;
  clear: () => void;
}

export const usePhotoReviewStore = create<PhotoReviewState>()((set) => ({
  assets: [],
  setAssets: (assets) => set({ assets }),
  clear: () => set({ assets: [] }),
}));
