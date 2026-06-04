import request from 'supertest';
import { db } from '../db';
import { dayLabels } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

const app = require('../app');

describe('Day labels — GET range', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns labels in a date range', async () => {
    await db.insert(dayLabels).values([
      { albumId: album.id, date: '2026-06-01', label: '1 tháng tuổi', updatedBy: user.id },
      { albumId: album.id, date: '2026-06-15', label: 'Sinh nhật', updatedBy: user.id },
      { albumId: album.id, date: '2026-07-01', label: 'Out of range', updatedBy: user.id },
    ]);

    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((l: any) => l.date)).toEqual(['2026-06-01', '2026-06-15']);
    expect(res.body[0].label).toBe('1 tháng tuổi');
  });

  it('returns 400 when from > to', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-12-01&to=2026-01-01`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
