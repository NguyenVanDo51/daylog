jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
const app = require('../app');

import { sendPush } from '../services/apns';

const mockSendPush = sendPush as jest.Mock;

async function createTestPhoto(albumId: string, uploadedBy: string): Promise<{ id: string }> {
  const { rows: [photo] } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, thumbnail_key, taken_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [albumId, uploadedBy, `r2-key-${Date.now()}`, `thumb-key-${Date.now()}`, new Date().toISOString()]
  );
  return photo;
}

describe('GET /photos/:photoId/reactions', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });

  it('returns an empty array when no reactions exist', async () => {
    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns counts grouped by emoji', async () => {
    const user2 = await createTestUser({ apple_sub: 'user2-sub' });
    const user3 = await createTestUser({ apple_sub: 'user3-sub' });

    // user reacts with ❤️
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    // user2 reacts with ❤️
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user2))
      .send({ emoji: '❤️' });

    // user3 reacts with 😂
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user3))
      .send({ emoji: '😂' });

    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    const heart = res.body.find((r: any) => r.emoji === '❤️');
    const laugh = res.body.find((r: any) => r.emoji === '😂');

    expect(heart).toBeDefined();
    expect(heart.count).toBe(2);
    expect(laugh).toBeDefined();
    expect(laugh.count).toBe(1);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get(`/photos/${photoId}/reactions`);
    expect(res.status).toBe(401);
  });
});

describe('POST /photos/:photoId/reactions', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });

  it('returns 400 for an invalid emoji', async () => {
    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '🤡' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('returns 400 for missing emoji', async () => {
    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid emoji');
  });

  it('creates a reaction and returns 201', async () => {
    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('upserts reaction — second POST with different emoji replaces the first', async () => {
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '😂' });

    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(res.status).toBe(200);
    // Only one reaction per user — should have 😂 with count 1, no ❤️
    expect(res.body).toHaveLength(1);
    expect(res.body[0].emoji).toBe('😂');
    expect(res.body[0].count).toBe(1);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .send({ emoji: '❤️' });
    expect(res.status).toBe(401);
  });

  it('does not send push notification when the reactor is the photo uploader', async () => {
    // user uploaded the photo and also reacts to it — no push expected
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('sends push notification when another user reacts to the photo', async () => {
    const uploader = await createTestUser({ apple_sub: 'uploader-sub' });
    // Give uploader an apns token
    await pool.query(`UPDATE users SET apns_token = 'device-token-uploader' WHERE id = $1`, [uploader.id]);

    const album = await createTestAlbum(uploader.id);
    const photo = await createTestPhoto(album.id, uploader.id);

    const reactor = await createTestUser({ apple_sub: 'reactor-sub' });

    await request(app)
      .post(`/photos/${photo.id}/reactions`)
      .set(authHeader(reactor))
      .send({ emoji: '😍' });

    expect(mockSendPush).toHaveBeenCalledWith(
      ['device-token-uploader'],
      'Có reaction mới!',
      expect.stringContaining('😍'),
      { photoId: photo.id }
    );
  });
});

describe('DELETE /photos/:photoId/reactions', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
    const album = await createTestAlbum(user.id);
    const photo = await createTestPhoto(album.id, user.id);
    photoId = photo.id;
    mockSendPush.mockClear();
  });

  it('removes the user reaction and returns 204', async () => {
    // First add a reaction
    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    // Then delete it
    const res = await request(app)
      .delete(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(res.status).toBe(204);

    // Verify it's gone
    const getRes = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(getRes.body).toEqual([]);
  });

  it('returns 204 even when the user has no reaction to delete (idempotent)', async () => {
    const res = await request(app)
      .delete(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(res.status).toBe(204);
  });

  it('only removes the requesting user reaction, not others', async () => {
    const user2 = await createTestUser({ apple_sub: 'user2-delete-sub' });

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(headers)
      .send({ emoji: '❤️' });

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user2))
      .send({ emoji: '😂' });

    // Delete only user's reaction
    await request(app)
      .delete(`/photos/${photoId}/reactions`)
      .set(headers);

    const getRes = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(headers);

    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].emoji).toBe('😂');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).delete(`/photos/${photoId}/reactions`);
    expect(res.status).toBe(401);
  });
});
