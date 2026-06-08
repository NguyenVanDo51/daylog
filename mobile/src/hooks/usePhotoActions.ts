import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useDeletePhoto(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: string) => {
      await api.delete(`/photos/${photoId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-photos', albumId, date] });
      qc.invalidateQueries({ queryKey: ['album-days', albumId] });
    },
  });
}

export function useUpdateCaption(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      photoId,
      caption,
    }: {
      photoId: string;
      caption: string | null;
    }) => {
      const { data } = await api.patch(`/photos/${photoId}`, { caption });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-photos', albumId, date] });
    },
  });
}
