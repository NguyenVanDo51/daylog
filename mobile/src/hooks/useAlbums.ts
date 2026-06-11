import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Album {
  id: string;
  name: string;
  child_birthdate: string | null;
  cover_photo_id: string | null;
  cover_thumb_url: string | null;
  created_by: string;
  created_at: string;
  is_private: boolean;
  my_role: 'admin' | 'member';
  archived_at: string | null;
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
