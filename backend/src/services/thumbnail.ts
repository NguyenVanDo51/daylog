import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { getObjectBuffer, putObject } from './r2';

export async function generateThumbnail(r2Key: string): Promise<string> {
  const buffer = await getObjectBuffer(r2Key);
  const thumb = await sharp(buffer)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const thumbKey = `thumbnails/${randomUUID()}.webp`;
  await putObject(thumbKey, thumb);
  return thumbKey;
}
