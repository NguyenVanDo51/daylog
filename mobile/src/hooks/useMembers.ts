import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

export interface Member {
  id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'admin' | 'member';
  joined_at: string;
}

export function useMembers() {
  const albumId = useAlbumStore((s) => s.albumId);
  return useQuery<Member[]>({
    queryKey: ['members', albumId],
    queryFn: async () => {
      const { data } = await api.get(`/albums/${albumId}/members`);
      return data;
    },
    enabled: !!albumId,
  });
}
