import { create } from 'zustand';

export interface PendingPhoto {
  id: string;
  localUri: string;
  status: 'uploading' | 'done' | 'error';
}

interface PendingUploadState {
  pendingPhotos: PendingPhoto[];
  addPending: (photos: Array<{ id: string; localUri: string }>) => void;
  markDone: (id: string) => void;
  markError: (id: string) => void;
  clearAll: () => void;
}

export const usePendingUploadStore = create<PendingUploadState>()((set) => ({
  pendingPhotos: [],
  addPending: (photos) =>
    set((s) => ({
      pendingPhotos: [
        ...s.pendingPhotos,
        ...photos.map((p) => ({ ...p, status: 'uploading' as const })),
      ],
    })),
  markDone: (id) =>
    set((s) => ({
      pendingPhotos: s.pendingPhotos.map((p) =>
        p.id === id ? { ...p, status: 'done' as const } : p,
      ),
    })),
  markError: (id) =>
    set((s) => ({
      pendingPhotos: s.pendingPhotos.map((p) =>
        p.id === id ? { ...p, status: 'error' as const } : p,
      ),
    })),
  clearAll: () => set({ pendingPhotos: [] }),
}));
