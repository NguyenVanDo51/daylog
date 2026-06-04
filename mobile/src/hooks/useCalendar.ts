import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface CalendarDay {
  photo: boolean;
  capture: boolean;
  milestone: boolean;
}

export type CalendarData = Record<string, CalendarDay>;

export function useCalendar(year: number, month: number) {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<CalendarData>({
    queryKey: ['calendar', albumId, year, month],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/calendar`, {
        params: { year: String(year), month: String(month) },
      });
      return data;
    },
    enabled: !!albumId,
  });
}
