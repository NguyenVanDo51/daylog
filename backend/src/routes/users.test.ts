jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn().mockResolvedValue({ url: 'https://r2.example.com/put', key: 'photos/test.jpg' }),
  getPresignedGetUrl: jest.fn().mockResolvedValue('https://r2.example.com/avatar.jpg'),
}));

import request from 'supertest';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createTestUser, authHeader } from '../../tests/setup';
import { getPresignedPutUrl } from '../services/r2';
const mockPut = getPresignedPutUrl as jest.Mock;
const app = require('../app');

describe('GET /users/me', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/users/me');
    expect(res.status).toBe(401);
  });

  it('returns user profile', async () => {
    const user = await createTestUser({ display_name: 'Test User' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.display_name).toBe('Test User');
  });

  it('resolves R2 key in avatar_url to presigned URL', async () => {
    const user = await createTestUser({ avatar_url: 'avatars/some-key.jpg' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://r2.example.com/avatar.jpg');
  });

  it('passes through Google avatar URL unchanged', async () => {
    const user = await createTestUser({ avatar_url: 'https://lh3.googleusercontent.com/a/photo.jpg' });
    const res = await request(app).get('/users/me').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://lh3.googleusercontent.com/a/photo.jpg');
  });
});

describe('PATCH /users/me', () => {
  it('updates display_name', async () => {
    const user = await createTestUser({ display_name: 'Old Name' });
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ display_name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe('New Name');
  });

  it('updates avatar_url key', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ avatar_url: 'avatars/uuid.jpg' });
    expect(res.status).toBe(200);
    expect(res.body.avatar_url).toBe('https://r2.example.com/avatar.jpg');
    // Verify key stored in DB
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.avatarUrl).toBe('avatars/uuid.jpg');
  });

  it('still updates push_token', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({ push_token: 'ExponentPushToken[abc]' });
    expect(res.status).toBe(200);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.pushToken).toBe('ExponentPushToken[abc]');
  });

  it('returns 204 with empty body', async () => {
    const user = await createTestUser();
    const res = await request(app).patch('/users/me').set(authHeader(user)).send({});
    expect(res.status).toBe(204);
  });
});

describe('POST /users/me/avatar-presign', () => {
  beforeEach(() => {
    mockPut.mockResolvedValue({ url: 'https://r2.example.com/put/avatars/uuid.jpg', key: 'avatars/uuid.jpg' });
  });

  it('returns upload_url and key', async () => {
    const user = await createTestUser();
    const res = await request(app).post('/users/me/avatar-presign').set(authHeader(user));
    expect(res.status).toBe(200);
    expect(res.body.upload_url).toBe('https://r2.example.com/put/avatars/uuid.jpg');
    expect(res.body.key).toBe('avatars/uuid.jpg');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/users/me/avatar-presign');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /users/me', () => {
  it('soft-deletes the user (sets deleted_at)', async () => {
    const user = await createTestUser();
    const res = await request(app).delete('/users/me').set(authHeader(user));
    expect(res.status).toBe(204);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).not.toBeNull();
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/users/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /users/me/restore', () => {
  it('clears deleted_at and returns token + user', async () => {
    const user = await createTestUser();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user.id));
    const restoreToken = require('jsonwebtoken').sign(
      { userId: user.id, purpose: 'restore' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '30m' }
    );
    const res = await request(app).post('/users/me/restore').send({ restore_token: restoreToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe(user.id);
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row.deletedAt).toBeNull();
  });

  it('returns 401 for invalid restore token', async () => {
    const res = await request(app).post('/users/me/restore').send({ restore_token: 'bad.token.here' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for regular auth token (wrong purpose)', async () => {
    const user = await createTestUser();
    const regularToken = require('jsonwebtoken').sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'test-secret'
    );
    const res = await request(app).post('/users/me/restore').send({ restore_token: regularToken });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/me/export', () => {
  it('returns 202 with message', async () => {
    const user = await createTestUser();
    const res = await request(app).get('/users/me/export').set(authHeader(user));
    expect(res.status).toBe(202);
    expect(res.body.message).toBeTruthy();
  });
});
