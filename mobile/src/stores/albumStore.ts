import { create } from 'zustand';

interface AlbumState {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
  setAlbum: (album: { id: string; name: string; child_birthdate: string | null }) => void;
  clearAlbum: () => void;
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albumId: null,
  albumName: null,
  childBirthdate: null,
  setAlbum: ({ id, name, child_birthdate }) =>
    set({ albumId: id, albumName: name, childBirthdate: child_birthdate }),
  clearAlbum: () => set({ albumId: null, albumName: null, childBirthdate: null }),
}));
