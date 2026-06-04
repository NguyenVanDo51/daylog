import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReactionCount {
  emoji: string;
  count: number;
}

export function useReactions(photoId: string) {
  return useQuery<ReactionCount[]>({
    queryKey: ['reactions', photoId],
    queryFn: async () => {
      const { data } = await api.get(`/photos/${photoId}/reactions`);
      return data;
    },
    enabled: !!photoId,
  });
}

export function useReact(photoId: string) {
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: async (emoji: string) => {
      await api.post(`/photos/${photoId}/reactions`, { emoji });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', photoId] }),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/photos/${photoId}/reactions`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', photoId] }),
  });

  return { add, remove };
}
