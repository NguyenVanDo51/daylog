import request from 'supertest';
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
