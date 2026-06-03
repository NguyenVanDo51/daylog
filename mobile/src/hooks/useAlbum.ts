import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Album {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
}

export function useAlbum() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Album>({
    queryKey: ['album', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}`);
      return data;
    },
    enabled: !!albumId,
  });
}
