jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn(),
  getPresignedGetUrl: jest.fn(),
}));
jest.mock('../services/thumbnail', () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb/x.webp', width: 100, height: 100 }),
}));
jest.mock('../services/push', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { soundtracks, daySoundtracks, albums } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
import { randomUUID } from 'crypto';
const app = require('../app');

async function insertSoundtrack(overrides: Partial<{
  key: string; title: string; artist: string | null; durationMs: number; isActive: boolean;
}> = {}) {
  const [t] = await db.insert(soundtracks).values({
    key: overrides.key ?? `key-${randomUUID()}`,
    title: overrides.title ?? 'Lullaby',
    artist: overrides.artist ?? 'Test',
    durationMs: overrides.durationMs ?? 30000,
    filePath: 'soundtracks/test.mp3',
    isActive: overrides.isActive ?? true,
  }).returning();
  return t;
}

describe('GET /albums/:id/days/:date/soundtrack', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns null when no soundtrack is set for the day', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns the joined soundtrack row when one is set', async () => {
    const track = await insertSoundtrack({ title: 'Sunshine', artist: 'Family', durationMs: 25000 });
    await db.insert(daySoundtracks).values({
      albumId: album.id, date: '2026-06-13', soundtrackId: track.id, updatedBy: user.id,
    });
    const res = await request(app)
      .get(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: track.id, title: 'Sunshine', artist: 'Family', duration_ms: 25000, is_active: true,
    });
  });

  it('returns 400 for invalid albumId', async () => {
    const res = await request(app)
      .get('/albums/not-a-uuid/days/2026-06-13/soundtrack')
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/days/13-06-2026/soundtrack`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-snd-get' });
    const res = await request(app)
      .get(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('requires auth', async () => {
    const res = await request(app).get(`/albums/${album.id}/days/2026-06-13/soundtrack`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /albums/:id/days/:date/soundtrack', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('inserts a new selection and returns it', async () => {
    const track = await insertSoundtrack();
    const res = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: track.id });
    expect(res.status).toBe(200);
    expect(res.body.soundtrack_id).toBe(track.id);
    expect(res.body.updated_by).toBe(user.id);
  });

  it('upserts when an entry for the same album+date already exists', async () => {
    const first = await insertSoundtrack();
    const second = await insertSoundtrack({ title: 'Other' });

    await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: first.id });

    const res = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: second.id });
    expect(res.status).toBe(200);
    expect(res.body.soundtrack_id).toBe(second.id);

    const rows = await db.select().from(daySoundtracks)
      .where(eq(daySoundtracks.albumId, album.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].soundtrackId).toBe(second.id);
  });

  it('returns 400 for invalid albumId', async () => {
    const track = await insertSoundtrack();
    const res = await request(app)
      .put('/albums/not-a-uuid/days/2026-06-13/soundtrack')
      .set(headers)
      .send({ soundtrack_id: track.id });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date', async () => {
    const track = await insertSoundtrack();
    const res = await request(app)
      .put(`/albums/${album.id}/days/2026/06/13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: track.id });
    expect(res.status).toBe(404);
  });

  it('returns 400 when soundtrack_id is missing or not a UUID', async () => {
    const res = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({});
    expect(res.status).toBe(400);

    const bad = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: 'nope' });
    expect(bad.status).toBe(400);
  });

  it('returns 400 when soundtrack id is unknown or inactive', async () => {
    const inactive = await insertSoundtrack({ isActive: false });
    const r1 = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: inactive.id });
    expect(r1.status).toBe(400);

    const r2 = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: randomUUID() });
    expect(r2.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const track = await insertSoundtrack();
    const other = await createTestUser({ apple_sub: 'other-snd-put' });
    const res = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(authHeader(other))
      .send({ soundtrack_id: track.id });
    expect(res.status).toBe(403);
  });

  it('returns 409 when the album is archived', async () => {
    const track = await insertSoundtrack();
    await db.update(albums).set({ archivedAt: new Date() }).where(eq(albums.id, album.id));
    const res = await request(app)
      .put(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers)
      .send({ soundtrack_id: track.id });
    expect(res.status).toBe(409);
  });
});

describe('DELETE /albums/:id/days/:date/soundtrack', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('removes the soundtrack and returns 204', async () => {
    const track = await insertSoundtrack();
    await db.insert(daySoundtracks).values({
      albumId: album.id, date: '2026-06-13', soundtrackId: track.id, updatedBy: user.id,
    });

    const res = await request(app)
      .delete(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers);
    expect(res.status).toBe(204);
    const rows = await db.select().from(daySoundtracks)
      .where(eq(daySoundtracks.albumId, album.id));
    expect(rows).toHaveLength(0);
  });

  it('is idempotent (returns 204 even with nothing to delete)', async () => {
    const res = await request(app)
      .delete(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers);
    expect(res.status).toBe(204);
  });

  it('returns 400 for invalid albumId', async () => {
    const res = await request(app)
      .delete('/albums/not-a-uuid/days/2026-06-13/soundtrack')
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid date', async () => {
    const res = await request(app)
      .delete(`/albums/${album.id}/days/bad-date/soundtrack`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'other-snd-del' });
    const res = await request(app)
      .delete(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('returns 409 when the album is archived', async () => {
    await db.update(albums).set({ archivedAt: new Date() }).where(eq(albums.id, album.id));
    const res = await request(app)
      .delete(`/albums/${album.id}/days/2026-06-13/soundtrack`)
      .set(headers);
    expect(res.status).toBe(409);
  });
});
