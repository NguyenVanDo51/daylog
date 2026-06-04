import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(albumId: string, userId: string, takenAt: string, source = 'upload') {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at, source)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt, source]
  );
  return rows[0];
}

async function insertMilestone(albumId: string, userId: string, occurredAt: string) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'Test milestone', occurredAt]
  );
  return rows[0];
}

describe('GET /albums/:id/calendar', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns dates with correct flags for the given month', async () => {
    await insertPhoto(album.id, user.id, '2025-06-03T10:00:00Z', 'upload');
    await insertPhoto(album.id, user.id, '2025-06-04T10:00:00Z', 'capture');
    await insertMilestone(album.id, user.id, '2025-06-04T10:00:00Z');

    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body['2025-06-03']).toEqual({ photo: true, capture: false, milestone: false });
    expect(res.body['2025-06-04']).toEqual({ photo: false, capture: true, milestone: true });
  });

  it('does not include dates from other months', async () => {
    await insertPhoto(album.id, user.id, '2025-05-31T10:00:00Z', 'upload');
    await insertPhoto(album.id, user.id, '2025-06-01T10:00:00Z', 'upload');

    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body['2025-05-31']).toBeUndefined();
    expect(res.body['2025-06-01']).toBeDefined();
  });

  it('returns empty object for a month with no content', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('returns 400 for invalid year or month', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=abc&month=6`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'stranger2' });
    const res = await request(app)
      .get(`/albums/${album.id}/calendar?year=2025&month=6`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
