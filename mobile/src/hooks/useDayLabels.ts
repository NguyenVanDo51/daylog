import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface DayLabel {
  date: string;
  label: string;
  updated_at: string;
  updated_by: string;
}

export function useDayLabelsRange(from: string, to: string) {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<DayLabel[]>({
    queryKey: ['day-labels', albumId, from, to],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/day-labels?from=${from}&to=${to}`);
      return data;
    },
    enabled: !!albumId,
  });
}

export function useUpsertDayLabel() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async ({ date, label }: { date: string; label: string }) => {
      const { data } = await api.put(`/albums/${albumId}/day-labels/${date}`, { label });
      return data as DayLabel;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-labels', albumId] });
      qc.invalidateQueries({ queryKey: ['calendar', albumId] });
    },
  });
}

export function useDeleteDayLabel() {
  const qc = useQueryClient();
  const albumId = useAlbumStore((s) => s.albumId);
  return useMutation({
    mutationFn: async ({ date }: { date: string }) => {
      await api.delete(`/albums/${albumId}/day-labels/${date}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-labels', albumId] });
      qc.invalidateQueries({ queryKey: ['calendar', albumId] });
    },
  });
}
