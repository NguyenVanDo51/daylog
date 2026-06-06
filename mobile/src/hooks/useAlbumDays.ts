import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AlbumDay {
  date: string;
  thumbnail_photo_id: string | null;
  has_video: boolean;
  photo_count: number;
}

export function useAlbumDays(albumId: string | null) {
  return useQuery<AlbumDay[]>({
    queryKey: ['album-days', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/days`);
      return data;
    },
    enabled: !!albumId,
  });
}
