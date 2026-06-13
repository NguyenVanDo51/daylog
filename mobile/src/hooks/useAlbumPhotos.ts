import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LibraryPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;
  uploaded_by: string;
  width: number | null;
  height: number | null;
  date: string;
  photo_url: string;
  thumb_url: string | null;
}

export interface LibraryDay {
  date: string;
  photos: LibraryPhoto[];
}

export function useAlbumPhotos(albumId: string | null) {
  return useQuery<LibraryDay[]>({
    queryKey: ['album-photos', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/photos`);
      return data;
    },
    enabled: !!albumId,
  });
}
