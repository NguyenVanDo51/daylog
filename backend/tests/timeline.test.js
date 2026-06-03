const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

async function insertPhoto(albumId, userId, takenAt) {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt]
  );
  return rows[0];
}

async function insertMilestone(albumId, userId, occurredAt) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'First smile', occurredAt]
  );
  return rows[0];
}

describe('GET /albums/:id/timeline', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id, { child_birthdate: '2024-01-01' });
    headers = authHeader(user);
  });

  it('returns photos and milestones merged in descending order', async () => {
    await insertPhoto(album.id, user.id, '2024-04-01T10:00:00Z');
    await insertMilestone(album.id, user.id, '2024-03-15T00:00:00Z');
    await insertPhoto(album.id, user.id, '2024-02-01T10:00:00Z');

    const res = await request(app).get(`/albums/${album.id}/timeline`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items[0].type).toBe('photo');
    expect(res.body.items[1].type).toBe('milestone');
    expect(res.body.items[2].type).toBe('photo');
  });

  it('paginates with cursor', async () => {
    for (let i = 1; i <= 5; i++) {
      await insertPhoto(album.id, user.id, `2024-0${i}-01T10:00:00Z`);
    }

    const first = await request(app).get(`/albums/${album.id}/timeline?limit=3`).set(headers);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.next_cursor).toBeDefined();

    const second = await request(app).get(`/albums/${album.id}/timeline?limit=3&cursor=${first.body.next_cursor}`).set(headers);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.next_cursor).toBeNull();
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser({ apple_sub: 'stranger' });
    const res = await request(app).get(`/albums/${album.id}/timeline`).set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
