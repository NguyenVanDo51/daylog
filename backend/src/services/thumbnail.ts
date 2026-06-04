import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { getObjectBuffer, putObject } from './r2';

export interface ThumbnailResult {
  key: string;
  width: number;
  height: number;
}

export async function generateThumbnail(r2Key: string): Promise<ThumbnailResult> {
  const buffer = await getObjectBuffer(r2Key);
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const thumb = await image
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const key = `thumbnails/${randomUUID()}.webp`;
  await putObject(key, thumb);
  return { key, width, height };
}
