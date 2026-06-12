import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { soundtracks, daySoundtracks } from '../db/schema';
import { createTestUser, authHeader, createTestAlbum } from '../../tests/setup';

const app = require('../app');

describe('GET /soundtracks', () => {
  it('returns active tracks sorted by sort_order', async () => {
    const user = await createTestUser();
    await db.insert(soundtracks).values([
      { key: 'b', title: 'B', durationMs: 10000, filePath: 'b.mp3', sortOrder: 2, isActive: true },
      { key: 'a', title: 'A', durationMs: 10000, filePath: 'a.mp3', sortOrder: 1, isActive: true },
      { key: 'inactive', title: 'I', durationMs: 10000, filePath: 'i.mp3', sortOrder: 0, isActive: false },
    ]);

    const res = await request(app).get('/soundtracks').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body.map((s: any) => s.key)).toEqual(['a', 'b']);
    expect(res.body[0]).toMatchObject({ key: 'a', title: 'A', duration_ms: 10000 });
  });

  it('requires auth', async () => {
    const res = await request(app).get('/soundtracks');
    expect(res.status).toBe(401);
  });
});

describe('GET /soundtracks/:key/file', () => {
  beforeEach(async () => {
    await db.insert(soundtracks).values({
      key: 'lullaby_01',
      title: 'Test',
      durationMs: 30000,
      filePath: 'lullaby_01.mp3',
      isActive: true,
    });
  });

  it('streams the mp3 with correct headers', async () => {
    const user = await createTestUser();
    const realPath = path.join(__dirname, '../../assets/soundtracks/lullaby_01.mp3');
    if (!fs.existsSync(realPath)) {
      throw new Error('fixture lullaby_01.mp3 missing — run Task 4 first');
    }

    const res = await request(app).get('/soundtracks/lullaby_01/file').set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/mpeg/);
    expect(res.headers['cache-control']).toMatch(/immutable/);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('returns 404 for unknown key', async () => {
    const user = await createTestUser();
    const res = await request(app).get('/soundtracks/nope/file').set(authHeader(user));
    expect(res.status).toBe(404);
  });

  it('returns 404 when key exists but file missing', async () => {
    await db.insert(soundtracks).values({
      key: 'ghost',
      title: 'Ghost',
      durationMs: 10000,
      filePath: 'does-not-exist.mp3',
      isActive: true,
    });
    const user = await createTestUser();
    const res = await request(app).get('/soundtracks/ghost/file').set(authHeader(user));
    expect(res.status).toBe(404);
  });
});

describe('Per-day soundtrack endpoints', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let trackId: string;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    const [t] = await db.insert(soundtracks).values({
      key: 'lullaby_01',
      title: 'Mây trắng',
      durationMs: 30000,
      filePath: 'lullaby_01.mp3',
      isActive: true,
    }).returning();
    trackId = t.id;
  });

  describe('GET /albums/:id/days/:date/soundtrack', () => {
    it('returns null when no soundtrack assigned', async () => {
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it('returns the soundtrack row when assigned', async () => {
      await db.insert(daySoundtracks).values({
        albumId: album.id,
        date: '2026-06-15',
        soundtrackId: trackId,
        updatedBy: user.id,
      });
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: trackId, key: 'lullaby_01', title: 'Mây trắng' });
    });

    it('returns inactive track too (mobile shows "unavailable" toast)', async () => {
      const [inactive] = await db.insert(soundtracks).values({
        key: 'old', title: 'Old', durationMs: 10000, filePath: 'old.mp3', isActive: false,
      }).returning();
      await db.insert(daySoundtracks).values({
        albumId: album.id, date: '2026-06-15', soundtrackId: inactive.id, updatedBy: user.id,
      });
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ key: 'old', is_active: false });
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other));
      expect(res.status).toBe(403);
    });

    it('400 for bad date format', async () => {
      const res = await request(app)
        .get(`/albums/${album.id}/days/15-06-2026/soundtrack`)
        .set(headers);
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /albums/:id/days/:date/soundtrack', () => {
    it('upserts an assignment', async () => {
      const res1 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: trackId });
      expect(res1.status).toBe(200);
      expect(res1.body.soundtrack_id).toBe(trackId);

      const [t2] = await db.insert(soundtracks).values({
        key: 'lullaby_02', title: 'Bình minh', durationMs: 40000, filePath: 'lullaby_02.mp3', isActive: true,
      }).returning();
      const res2 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: t2.id });
      expect(res2.status).toBe(200);
      expect(res2.body.soundtrack_id).toBe(t2.id);
    });

    it('400 when soundtrack_id missing or invalid UUID', async () => {
      const r1 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({});
      expect(r1.status).toBe(400);

      const r2 = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: 'not-a-uuid' });
      expect(r2.status).toBe(400);
    });

    it('400 when soundtrack does not exist', async () => {
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(400);
    });

    it('400 when soundtrack is inactive', async () => {
      const [inactive] = await db.insert(soundtracks).values({
        key: 'old2', title: 'Old', durationMs: 10000, filePath: 'old.mp3', isActive: false,
      }).returning();
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers).send({ soundtrack_id: inactive.id });
      expect(res.status).toBe(400);
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .put(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other)).send({ soundtrack_id: trackId });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /albums/:id/days/:date/soundtrack', () => {
    it('removes the assignment', async () => {
      await db.insert(daySoundtracks).values({
        albumId: album.id, date: '2026-06-15', soundtrackId: trackId, updatedBy: user.id,
      });
      const del = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(del.status).toBe(204);

      const get = await request(app)
        .get(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(get.body).toBeNull();
    });

    it('204 idempotent', async () => {
      const res = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(headers);
      expect(res.status).toBe(204);
    });

    it('403 for non-member', async () => {
      const other = await createTestUser();
      const res = await request(app)
        .delete(`/albums/${album.id}/days/2026-06-15/soundtrack`)
        .set(authHeader(other));
      expect(res.status).toBe(403);
    });
  });
});
