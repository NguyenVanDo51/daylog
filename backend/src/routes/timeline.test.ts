import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

async function insertPhoto(albumId: string, userId: string, takenAt: string) {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'photos/test.webp', takenAt]
  );
  return rows[0];
}

async function insertMilestone(albumId: string, userId: string, occurredAt: string) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, $3, $4) RETURNING *`,
    [albumId, userId, 'First smile', occurredAt]
  );
  return rows[0];
}

describe('GET /albums/:id/timeline', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

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

  it('returns 400 when cursor is not valid base64-encoded JSON', async () => {
    // 'Zm9vYmFy' is base64 for 'foobar' — decodes successfully but is not valid JSON
    const res = await request(app)
      .get(`/albums/${album.id}/timeline?cursor=Zm9vYmFy`)
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid cursor');
  });

  it('paginates correctly with a valid cursor across multiple pages', async () => {
    // Insert 4 items so with limit=2 we get two pages of 2 with next_cursor null on last
    await insertPhoto(album.id, user.id, '2024-04-01T10:00:00Z');
    await insertMilestone(album.id, user.id, '2024-03-15T00:00:00Z');
    await insertPhoto(album.id, user.id, '2024-02-01T10:00:00Z');
    await insertMilestone(album.id, user.id, '2024-01-15T00:00:00Z');

    const first = await request(app)
      .get(`/albums/${album.id}/timeline?limit=2`)
      .set(headers);
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(2);
    expect(first.body.next_cursor).toBeTruthy();
    expect(first.body.items[0].type).toBe('photo');
    expect(first.body.items[1].type).toBe('milestone');

    const second = await request(app)
      .get(`/albums/${album.id}/timeline?limit=2&cursor=${encodeURIComponent(first.body.next_cursor)}`)
      .set(headers);
    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(2);
    expect(second.body.next_cursor).toBeNull();
    expect(second.body.items[0].type).toBe('photo');
    expect(second.body.items[1].type).toBe('milestone');
  });

  it('defaults to limit=20 when limit=0 is given', async () => {
    for (let i = 0; i < 25; i++) {
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      await insertPhoto(album.id, user.id, `2024-${month}-${day}T10:00:00Z`);
    }

    const res = await request(app)
      .get(`/albums/${album.id}/timeline?limit=0`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(20);
    expect(res.body.next_cursor).toBeTruthy();
  });

  it('defaults to limit=20 when limit is a non-numeric string', async () => {
    for (let i = 0; i < 22; i++) {
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      await insertPhoto(album.id, user.id, `2024-${month}-${day}T10:00:00Z`);
    }

    const res = await request(app)
      .get(`/albums/${album.id}/timeline?limit=notanumber`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(20);
  });

  it('caps limit at 100 when a larger value is requested', async () => {
    // Insert 101 photos to verify the cap (would otherwise return 101)
    for (let i = 0; i < 101; i++) {
      const year = 2020 + Math.floor(i / 50);
      const month = String((i % 12) + 1).padStart(2, '0');
      const day = String((i % 28) + 1).padStart(2, '0');
      await insertPhoto(album.id, user.id, `${year}-${month}-${day}T10:00:00Z`);
    }

    const res = await request(app)
      .get(`/albums/${album.id}/timeline?limit=500`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(100);
    expect(res.body.next_cursor).toBeTruthy();
  });

  it('returns 500 when :id is not a valid UUID (catch branch)', async () => {
    const res = await request(app)
      .get('/albums/not-a-uuid/timeline')
      .set(headers);
    expect(res.status).toBe(500);
  });

  it('returns empty items and null next_cursor for an empty album', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/timeline`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.next_cursor).toBeNull();
  });
});
