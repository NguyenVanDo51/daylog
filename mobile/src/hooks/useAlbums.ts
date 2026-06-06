import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Album {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
  created_by: string;
  created_at: string;
  is_private: boolean;
}

export function useAlbums() {
  return useQuery<Album[]>({
    queryKey: ['albums'],
    queryFn: async () => {
      const { data } = await api.get('/albums');
      return data;
    },
  });
}
