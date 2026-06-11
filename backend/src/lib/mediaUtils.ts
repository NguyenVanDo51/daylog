import { getPresignedGetUrl } from '../services/r2';

export async function resolveAvatarUrl(url: string | null): Promise<string | null> {
  if (!url || url.startsWith('https://')) return url;
  return getPresignedGetUrl(url, 3600);
}
