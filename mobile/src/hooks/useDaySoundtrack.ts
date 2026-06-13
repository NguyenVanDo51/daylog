import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Soundtrack } from './useSoundtracks';

export function useDaySoundtrack(albumId: string | null, date: string | null) {
  return useQuery<Soundtrack | null>({
    queryKey: ['day-soundtrack', albumId, date],
    queryFn: async () => {
      const { data } = await api.get<Soundtrack | null>(`/albums/${albumId}/days/${date}/soundtrack`);
      return data;
    },
    enabled: !!albumId && !!date,
  });
}
