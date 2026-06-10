import { create } from 'zustand';

interface AlbumState {
  albumId: string | null;
  albumName: string | null;
  childBirthdate: string | null;
  isPrivate: boolean | null;
  myRole: 'admin' | 'member' | null;
  archivedAt: string | null;
  setAlbum: (album: {
    id: string;
    name: string;
    child_birthdate: string | null;
    is_private: boolean;
    my_role: 'admin' | 'member';
    archived_at: string | null;
  }) => void;
  setAlbumName: (name: string) => void;
  setArchivedAt: (archivedAt: string) => void;
  clearAlbum: () => void;
}

export const useAlbumStore = create<AlbumState>((set) => ({
  albumId: null,
  albumName: null,
  childBirthdate: null,
  isPrivate: null,
  myRole: null,
  archivedAt: null,
  setAlbum: ({ id, name, child_birthdate, is_private, my_role, archived_at }) =>
    set({
      albumId: id,
      albumName: name,
      childBirthdate: child_birthdate,
      isPrivate: is_private,
      myRole: my_role,
      archivedAt: archived_at,
    }),
  setAlbumName: (name) => set({ albumName: name }),
  setArchivedAt: (archivedAt) => set({ archivedAt }),
  clearAlbum: () =>
    set({
      albumId: null,
      albumName: null,
      childBirthdate: null,
      isPrivate: null,
      myRole: null,
      archivedAt: null,
    }),
}));
