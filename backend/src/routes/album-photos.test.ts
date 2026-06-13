jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn(),
  getPresignedGetUrl: jest.fn(async (key: string) => `https://r2.signed/${key}?sig=test`),
}));
jest.mock('../services/thumbnail', () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb/x.webp', width: 100, height: 100 }),
}));
jest.mock('../services/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { db } from '../db';
import { photos, albumPhotos } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(
  userId: string,
  albumId: string,
  opts: {
    takenAt?: string;
    mediaType?: 'photo' | 'video';
    caption?: string | null;
    durationMs?: number | null;
    width?: number | null;
    height?: number | null;
    thumbnailKey?: string | null;
  } = {},
) {
  const [p] = await db
    .insert(photos)
    .values({
      albumId,
      uploadedBy: userId,
      r2Key: `photos/${Math.random()}.webp`,
      thumbnailKey: opts.thumbnailKey === undefined ? `thumbnails/${Math.random()}.webp` : opts.thumbnailKey,
      takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
      mediaType: opts.mediaType ?? 'photo',
      source: 'capture',
      caption: opts.caption ?? null,
      durationMs: opts.durationMs ?? null,
      width: opts.width ?? null,
      height: opts.height ?? null,
    })
    .returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}

describe('GET /albums/:id/photos', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns photos grouped by date, newest day first, ascending within day', async () => {
    const earlier = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });
    const later = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T14:00:00Z' });
    const yesterday = await insertPhoto(user.id, album.id, { takenAt: '2026-05-20T09:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/photos`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe('2026-05-21');
    expect(res.body[0].photos.map((p: { id: string }) => p.id)).toEqual([earlier.id, later.id]);
    expect(res.body[1].date).toBe('2026-05-20');
    expect(res.body[1].photos[0].id).toBe(yesterday.id);
  });

  it('returns presigned photo_url and thumb_url; thumb_url null when no thumbnail_key', async () => {
    await insertPhoto(user.id, album.id, { thumbnailKey: null });
    const res = await request(app).get(`/albums/${album.id}/photos`).set(headers);
    expect(res.status).toBe(200);
    const photo = res.body[0].photos[0];
    expect(photo.photo_url).toMatch(/^https:\/\/r2\.signed\//);
    expect(photo.thumb_url).toBeNull();
  });

  it('serialises taken_at as ISO 8601 with milliseconds + Z', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:30:15Z' });
    const res = await request(app).get(`/albums/${album.id}/photos`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].photos[0].taken_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('exposes media_type, duration_ms, caption, width, height and uploaded_by', async () => {
    await insertPhoto(user.id, album.id, {
      mediaType: 'video',
      durationMs: 2000,
      caption: 'Em bé cười',
      width: 1080,
      height: 1920,
    });
    const res = await request(app).get(`/albums/${album.id}/photos`).set(headers);
    expect(res.status).toBe(200);
    const photo = res.body[0].photos[0];
    expect(photo).toMatchObject({
      media_type: 'video',
      duration_ms: 2000,
      caption: 'Em bé cười',
      width: 1080,
      height: 1920,
      uploaded_by: user.id,
    });
  });

  it('returns empty list when album has no photos', async () => {
    const res = await request(app).get(`/albums/${album.id}/photos`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 400 for an invalid albumId', async () => {
    const res = await request(app).get('/albums/not-a-uuid/photos').set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members of the album', async () => {
    const other = await createTestUser({ apple_sub: 'other-album-photos' });
    const res = await request(app).get(`/albums/${album.id}/photos`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('requires authentication', async () => {
    const res = await request(app).get(`/albums/${album.id}/photos`);
    expect(res.status).toBe(401);
  });
});
