import { create } from 'zustand';

interface AlbumState {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
  isPrivate: boolean | null;
  setAlbum: (album: {
    id: string;
    name: string;
    child_birthdate: string | null;
    is_private: boolean;
  }) => void;
  clearAlbum: () => void;
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albumId: null,
  albumName: null,
  childBirthdate: null,
  isPrivate: null,
  setAlbum: ({ id, name, child_birthdate, is_private }) =>
    set({ albumId: id, albumName: name, childBirthdate: child_birthdate, isPrivate: is_private }),
  clearAlbum: () =>
    set({ albumId: null, albumName: null, childBirthdate: null, isPrivate: null }),
}));
