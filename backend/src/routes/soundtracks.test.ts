import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { db } from '../db';
import { soundtracks } from '../db/schema';
import { createTestUser, authHeader } from '../../tests/setup';

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
