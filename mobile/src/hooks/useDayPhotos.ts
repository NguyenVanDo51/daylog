import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DayPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;
  uploaded_by: string;
  photo_url: string;
  thumb_url: string | null;
}

export function useDayPhotos(albumId: string | null, date: string | null) {
  return useQuery<DayPhoto[]>({
    queryKey: ['day-photos', albumId, date],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/days/${date}/photos`);
      return data;
    },
    enabled: !!albumId && !!date,
  });
}
