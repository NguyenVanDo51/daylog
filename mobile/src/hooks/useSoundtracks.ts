import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Soundtrack {
  id: string;
  key: string;
  title: string;
  artist: string | null;
  duration_ms: number;
  is_active?: boolean;
}

export function useSoundtracks() {
  return useQuery<Soundtrack[]>({
    queryKey: ['soundtracks'],
    queryFn: async () => {
      const { data } = await api.get<Soundtrack[]>('/soundtracks');
      return data;
    },
    staleTime: Infinity,
  });
}
