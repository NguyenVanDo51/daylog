jest.mock('../services/r2', () => ({ getPresignedPutUrl: jest.fn() }));
jest.mock('../services/thumbnail', () => ({ generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb/x.webp', width: 100, height: 100 }) }));
jest.mock('../services/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { db } from '../db';
import { photos, albumPhotos } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(userId: string, albumId: string, opts: { takenAt?: string; mediaType?: string; caption?: string | null } = {}) {
  const [p] = await db.insert(photos).values({
    albumId,
    uploadedBy: userId,
    r2Key: `photos/${Math.random()}.webp`,
    thumbnailKey: `thumbnails/${Math.random()}.webp`,
    takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
    mediaType: opts.mediaType ?? 'photo',
    source: 'capture',
    caption: opts.caption ?? null,
  }).returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}

describe('GET /albums/:id/days', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns days with photo counts, newest first', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T12:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-20T09:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].date).toBe('2026-05-21');
    expect(res.body[0].photo_count).toBe(2);
    expect(res.body[1].date).toBe('2026-05-20');
    expect(res.body[1].photo_count).toBe(1);
  });

  it('sets has_video true when at least one video exists', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z', mediaType: 'video' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T11:00:00Z', mediaType: 'photo' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].has_video).toBe(true);
  });

  it('returns thumbnail_photo_id for the earliest photo that day', async () => {
    const early = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T10:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].thumbnail_photo_id).toBe(early.id);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-days' });
    const res = await request(app).get(`/albums/${album.id}/days`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('only returns days from this album via album_photos join', async () => {
    const other = await createTestAlbum(user.id);
    // Insert photo only into `other` album's album_photos (not into our album)
    const [p] = await db.insert(photos).values({
      albumId: other.id,
      uploadedBy: user.id,
      r2Key: `photos/${Math.random()}.webp`,
      thumbnailKey: `thumbnails/${Math.random()}.webp`,
      takenAt: new Date('2026-05-21T10:00:00Z'),
      mediaType: 'photo',
      source: 'capture',
    }).returning();
    await db.insert(albumPhotos).values({ photoId: p.id, albumId: other.id });

    const res = await request(app).get(`/albums/${album.id}/days`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });
});

describe('GET /albums/:id/days/:date/photos', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns photos for that day ordered by taken_at asc', async () => {
    const p1 = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });
    const p2 = await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T12:00:00Z' });
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-22T08:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/days/2026-05-21/photos`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(p1.id);
    expect(res.body[1].id).toBe(p2.id);
    expect(res.body[0]).toMatchObject({ id: p1.id, media_type: 'photo' });
    // taken_at must be ISO 8601 so React Native can parse it with new Date()
    expect(res.body[0].taken_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('returns caption field for each photo', async () => {
    await insertPhoto(user.id, album.id, {
      takenAt: '2026-05-21T08:00:00Z',
      caption: 'Bữa sáng gia đình',
    });
    await insertPhoto(user.id, album.id, {
      takenAt: '2026-05-21T09:00:00Z',
      caption: null,
    });

    const res = await request(app)
      .get(`/albums/${album.id}/days/2026-05-21/photos`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body[0].caption).toBe('Bữa sáng gia đình');
    expect(res.body[1].caption).toBeNull();
  });

  it('returns uploaded_by for each photo', async () => {
    await insertPhoto(user.id, album.id, { takenAt: '2026-05-21T08:00:00Z' });

    const res = await request(app)
      .get(`/albums/${album.id}/days/2026-05-21/photos`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body[0].uploaded_by).toBe(user.id);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app).get(`/albums/${album.id}/days/21-05-2026/photos`).set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-day-photos' });
    const res = await request(app).get(`/albums/${album.id}/days/2026-05-21/photos`).set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
