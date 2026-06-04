import { create } from 'zustand';

export interface SyncedPhoto {
  localAssetId: string;
  compressedBytes: number;
}

interface UploadState {
  syncedPhotos: SyncedPhoto[];
  addSynced: (photo: SyncedPhoto) => void;
  removeSynced: (localAssetId: string) => void;
  clearAll: () => void;
}

export const useUploadStore = create<UploadState>()((set) => ({
  syncedPhotos: [],
  addSynced: (photo) =>
    set((s) => ({
      syncedPhotos: s.syncedPhotos.some((p) => p.localAssetId === photo.localAssetId)
        ? s.syncedPhotos
        : [...s.syncedPhotos, photo],
    })),
  removeSynced: (localAssetId) =>
    set((s) => ({
      syncedPhotos: s.syncedPhotos.filter((p) => p.localAssetId !== localAssetId),
    })),
  clearAll: () => set({ syncedPhotos: [] }),
}));
