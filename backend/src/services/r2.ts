import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  // AWS SDK v3 ≥ 3.600 auto-injects CRC32 checksums; R2 rejects presigned PUTs that
  // include a checksum query param the client doesn't echo back.
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const BUCKET = process.env.R2_BUCKET || '';

export async function getPresignedGetUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

export async function getPresignedPutUrl(
  contentType: 'image/webp' | 'image/jpeg' | 'video/mp4' = 'image/webp'
): Promise<{ url: string; key: string }> {
  const ext = contentType === 'video/mp4' ? 'mp4'
    : contentType === 'image/jpeg' ? 'jpg'
    : 'webp';
  const key = `photos/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  const url = await getSignedUrl(r2, command, { expiresIn: 3600 });
  return { url, key };
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await r2.send(command);
  const chunks: Buffer[] = [];
  // aws-sdk types Body as a sprawling union (Readable | ReadableStream | Blob);
  // at runtime on Node it is an async-iterable Readable stream.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for await (const chunk of response.Body as any) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function putObject(
  key: string,
  buffer: Buffer,
  contentType = 'image/webp'
): Promise<void> {
  await r2.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

// TODO: sweep orphaned R2 objects. Both presign flows (POST /users/me/avatar-presign
// and POST /photos/presign) hand out keys that may never be referenced by the DB
// — e.g. user picks an avatar then closes the screen without saving, or capture
// uploads succeed but POST /photos fails. List bucket objects, diff against
// users.avatarUrl + photos.r2Key + photos.thumbnailKey, delete anything older
// than a grace window (e.g. 24h) with no DB reference.
