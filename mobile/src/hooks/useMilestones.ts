import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Milestone {
  id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  cover_photo_id: string | null;
  icon: string | null;
}

export function useMilestones() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Milestone[]>({
    queryKey: ['milestones', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/milestones`);
      return data;
    },
    enabled: !!albumId,
  });
}

export function useCreateMilestone() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async (body: { title: string; note?: string; occurred_at: string; cover_photo_id?: string }) => {
      const { data } = await api.post(`/albums/${albumId}/milestones`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['milestones', albumId] });
      qc.invalidateQueries({ queryKey: ['timeline', albumId] });
    },
  });
}
