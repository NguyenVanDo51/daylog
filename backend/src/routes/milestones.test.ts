import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

const app = require('../app');
import { sendPush } from '../services/apns';
const mockSendPush = sendPush as jest.Mock;

describe('Milestones', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockSendPush.mockResolvedValue(undefined);
  });

  it('POST /albums/:id/milestones creates a milestone', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First steps', note: 'She walked!', occurred_at: '2024-09-15T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('First steps');
    expect(res.body.note).toBe('She walked!');
  });

  it('GET /albums/:id/milestones returns all milestones sorted by occurred_at desc', async () => {
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First steps', occurred_at: '2024-09-01T00:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/milestones`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('First steps');
    expect(res.body[1].title).toBe('First smile');
  });

  it('PATCH /milestones/:id updates a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ note: 'So cute!' });

    expect(res.status).toBe(200);
    expect(res.body.note).toBe('So cute!');
  });

  it('DELETE /milestones/:id deletes a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app).delete(`/milestones/${created.body.id}`).set(headers);
    expect(res.status).toBe(204);
  });

  it('sends push notification when milestone is created', async () => {
    await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    expect(mockSendPush).toHaveBeenCalled();
  });

  // --- POST validation ---

  it('POST without title returns 400', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ occurred_at: '2024-09-15T00:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title.*occurred_at/);
  });

  it('POST without occurred_at returns 400', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First steps' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title.*occurred_at/);
  });

  it('POST by non-member returns 403', async () => {
    const stranger = await createTestUser();
    const strangerHeaders = authHeader(stranger);
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(strangerHeaders)
      .send({ title: 'First steps', occurred_at: '2024-09-15T00:00:00Z' });
    expect(res.status).toBe(403);
  });

  it('POST returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .post(`/albums/not-a-uuid/milestones`)
      .set(headers)
      .send({ title: 'First steps', occurred_at: '2024-09-15T00:00:00Z' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  it('POST success without other members calls sendPush with empty tokens', async () => {
    mockSendPush.mockClear();
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Solo milestone', occurred_at: '2024-09-15T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Solo milestone');
    expect(mockSendPush).toHaveBeenCalled();
    const callArgs = mockSendPush.mock.calls[0];
    expect(callArgs[0]).toEqual([]);
  });

  it('POST success with another member who has apns_token passes that token to sendPush', async () => {
    const otherUser = await createTestUser();
    await pool.query('UPDATE users SET apns_token = $1 WHERE id = $2', ['dev-token-xxx', otherUser.id]);
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, otherUser.id]
    );

    mockSendPush.mockClear();
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Shared milestone', occurred_at: '2024-09-15T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(mockSendPush).toHaveBeenCalled();
    const callArgs = mockSendPush.mock.calls[0];
    expect(callArgs[0]).toContain('dev-token-xxx');
  });

  // --- GET ---

  it('GET by non-member returns 403', async () => {
    const stranger = await createTestUser();
    const strangerHeaders = authHeader(stranger);
    const res = await request(app)
      .get(`/albums/${album.id}/milestones`)
      .set(strangerHeaders);
    expect(res.status).toBe(403);
  });

  it('GET returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .get(`/albums/not-a-uuid/milestones`)
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  // --- PATCH ---

  it('PATCH by non-member returns 403', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const stranger = await createTestUser();
    const strangerHeaders = authHeader(stranger);
    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(strangerHeaders)
      .send({ note: 'Trying to edit' });
    expect(res.status).toBe(403);
  });

  it('PATCH with only title updates title', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Old title', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ title: 'New title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
  });

  it('PATCH with only note updates note', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Title', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ note: 'A note' });
    expect(res.status).toBe(200);
    expect(res.body.note).toBe('A note');
  });

  it('PATCH with only occurred_at updates occurred_at', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Title', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ occurred_at: '2024-04-01T00:00:00Z' });
    expect(res.status).toBe(200);
    expect(new Date(res.body.occurred_at).toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });

  it('PATCH with only cover_photo_id updates cover_photo_id', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Title', occurred_at: '2024-03-01T00:00:00Z' });

    // Insert a photo to reference
    const { rows: photoRows } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, $3, $4) RETURNING *`,
      [album.id, user.id, 'photos/test.jpg', '2024-03-01T00:00:00Z']
    );
    const photoId = photoRows[0].id;

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ cover_photo_id: photoId });
    expect(res.status).toBe(200);
    expect(res.body.cover_photo_id).toBe(photoId);
  });

  it('PATCH with all four undefined performs no-op and returns existing milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Untouched', note: 'still here', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Untouched');
    expect(res.body.note).toBe('still here');
  });

  it('PATCH on nonexistent milestone id returns 403', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app)
      .patch(`/milestones/${fakeId}`)
      .set(headers)
      .send({ title: 'Nope' });
    expect(res.status).toBe(403);
  });

  it('PATCH returns 400 when milestoneId is not a valid UUID', async () => {
    const res = await request(app)
      .patch(`/milestones/not-a-uuid`)
      .set(headers)
      .send({ title: 'Bad id' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid milestoneId/);
  });

  it('PATCH returns 400 when cover_photo_id belongs to a different album', async () => {
    const { rows: [ms] } = await pool.query(
      `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, 'Test', NOW()) RETURNING id`,
      [album.id, user.id]
    );

    const other = await createTestUser({ apple_sub: 'other-cover' });
    const otherAlbum = await createTestAlbum(other.id);
    const { rows: [photo] } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at) VALUES ($1, $2, 'k', NOW()) RETURNING id`,
      [otherAlbum.id, other.id]
    );

    const res = await request(app)
      .patch(`/milestones/${ms.id}`)
      .set(authHeader(user))
      .send({ cover_photo_id: photo.id });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cover_photo_id does not belong to this album/);
  });

  // --- DELETE ---

  it('DELETE by non-member returns 403', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const stranger = await createTestUser();
    const strangerHeaders = authHeader(stranger);
    const res = await request(app)
      .delete(`/milestones/${created.body.id}`)
      .set(strangerHeaders);
    expect(res.status).toBe(403);
  });

  it('DELETE success by album admin returns 204', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'Admin-deletable', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .delete(`/milestones/${created.body.id}`)
      .set(headers);
    expect(res.status).toBe(204);
  });

  it('DELETE returns 403 when caller is a member but not admin', async () => {
    const member = await createTestUser({ apple_sub: 'member-delete-ms' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    const ms = await pool.query(
      `INSERT INTO milestones (album_id, created_by, title, occurred_at) VALUES ($1, $2, 'Test', NOW()) RETURNING id`,
      [album.id, user.id]
    );
    const res = await request(app)
      .delete(`/milestones/${ms.rows[0].id}`)
      .set(authHeader(member));
    expect(res.status).toBe(403);
  });

  it('DELETE returns 400 when milestoneId is not a valid UUID', async () => {
    const res = await request(app)
      .delete(`/milestones/not-a-uuid`)
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid milestoneId/);
  });
});
