import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useSetDaySoundtrack(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (soundtrackId: string | null) => {
      if (soundtrackId === null) {
        await api.delete(`/albums/${albumId}/days/${date}/soundtrack`);
      } else {
        await api.put(`/albums/${albumId}/days/${date}/soundtrack`, { soundtrack_id: soundtrackId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-soundtrack', albumId, date] }),
  });
}
