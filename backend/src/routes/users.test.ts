jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn().mockResolvedValue({ url: 'https://r2.example.com/put', key: 'photos/test.jpg' }),
  getPresignedGetUrl: jest.fn().mockResolvedValue('https://r2.example.com/avatar.jpg'),
}));

import request from 'supertest';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createTestUser, authHeader } from '../../tests/setup';
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
