import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface TimelinePhoto {
  type: 'photo';
  id: string;
  r2_key: string;
  thumbnail_key: string | null;
  taken_at: string;
  caption: string | null;
  media_type: 'photo' | 'video';
  source: 'capture' | 'upload';
  duration_ms: number | null;
}

export interface TimelineMilestone {
  type: 'milestone';
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  icon: string | null;
}

export type TimelineItem = TimelinePhoto | TimelineMilestone;

interface TimelinePage {
  items: TimelineItem[];
  nextCursor: string | null;
}

export function useTimeline() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useInfiniteQuery<TimelinePage>({
    queryKey: ['timeline', albumId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = { limit: '20' };
      if (pageParam) params.cursor = pageParam as string;
      const { data } = await api.get(`/albums/${albumId}/timeline`, { params });
      return data;
    },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!albumId,
  });
}
