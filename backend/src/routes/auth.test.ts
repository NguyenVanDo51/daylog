import request from 'supertest';
const app = require('../app');
import { pool } from '../db';
import jwt from 'jsonwebtoken';

jest.mock('../services/appleAuth');
jest.mock('../services/googleAuth');

import { verifyAppleToken } from '../services/appleAuth';
import { verifyGoogleToken } from '../services/googleAuth';

const mockVerifyApple = verifyAppleToken as jest.Mock;
const mockVerifyGoogle = verifyGoogleToken as jest.Mock;

describe('Security middleware', () => {
  it('sets X-Content-Type-Options: nosniff header on all responses', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('POST /auth/apple', () => {
  it('creates a new user and returns a JWT', async () => {
    mockVerifyApple.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: 'jane@example.com' });

    const res = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'fake-apple-token', apnsToken: 'device-token-abc' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.display_name).toBe('Jane Doe');

    const { rows } = await pool.query(`SELECT * FROM users WHERE apple_sub = 'apple-sub-123'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].apns_token).toBe('device-token-abc');
  });

  it('returns existing user on second sign-in', async () => {
    mockVerifyApple.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: null });

    await request(app).post('/auth/apple').send({ idToken: 'token' });
    const res = await request(app).post('/auth/apple').send({ idToken: 'token' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT * FROM users WHERE apple_sub = 'apple-sub-123'`);
    expect(rows).toHaveLength(1);
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/auth/apple').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idToken required');
  });

  it('persists apns_token when provided in the request body', async () => {
    mockVerifyApple.mockResolvedValueOnce({ sub: 'apple-sub-apns', name: 'Apns User', email: null });

    const res = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'token', apnsToken: 'apple-device-token-999' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT apns_token FROM users WHERE apple_sub = 'apple-sub-apns'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].apns_token).toBe('apple-device-token-999');
  });

  it('returns 500 when verifyAppleToken rejects', async () => {
    mockVerifyApple.mockRejectedValueOnce(new Error('token expired'));

    const res = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'bad-token' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');  // was: 'token expired'
  });
});

describe('POST /auth/google', () => {
  it('creates a new user and returns a JWT', async () => {
    mockVerifyGoogle.mockResolvedValue({ sub: 'google-sub-456', name: 'John Smith', picture: 'https://example.com/photo.jpg' });

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token', apnsToken: 'device-token-xyz' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.display_name).toBe('John Smith');
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/auth/google').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('idToken required');
  });

  it('stores apns_token as null when not provided in the request body', async () => {
    mockVerifyGoogle.mockResolvedValueOnce({ sub: 'google-sub-no-apns', name: 'No Apns', picture: null });

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'token' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT apns_token FROM users WHERE google_sub = 'google-sub-no-apns'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].apns_token).toBeNull();
  });

  it('stores display_name and avatar_url from the verified payload', async () => {
    mockVerifyGoogle.mockResolvedValueOnce({
      sub: 'google-sub-profile',
      name: 'Profile Name',
      picture: 'https://example.com/avatar.png',
    });

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'token' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT display_name, avatar_url FROM users WHERE google_sub = 'google-sub-profile'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].display_name).toBe('Profile Name');
    expect(rows[0].avatar_url).toBe('https://example.com/avatar.png');
  });

  it('takes the ON CONFLICT update path on second sign-in and preserves avatar_url via COALESCE', async () => {
    mockVerifyGoogle.mockResolvedValueOnce({
      sub: 'google-sub-conflict',
      name: 'Original Name',
      picture: 'https://example.com/original.png',
    });
    await request(app).post('/auth/google').send({ idToken: 'token-1' });

    mockVerifyGoogle.mockResolvedValueOnce({ sub: 'google-sub-conflict', name: null, picture: null });
    const res = await request(app).post('/auth/google').send({ idToken: 'token-2' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT display_name, avatar_url FROM users WHERE google_sub = 'google-sub-conflict'`);
    expect(rows).toHaveLength(1);
    // displayName is forced to 'Family Member' when name is null, so EXCLUDED overrides via COALESCE
    expect(rows[0].display_name).toBe('Family Member');
    // picture is null on second call, so COALESCE preserves the original avatar_url
    expect(rows[0].avatar_url).toBe('https://example.com/original.png');
  });

  it('returns 500 when verifyGoogleToken rejects', async () => {
    mockVerifyGoogle.mockRejectedValueOnce(new Error('invalid audience'));

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'bad-token' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal server error');  // was: 'invalid audience'
  });
});

describe('JWT token lifetime', () => {
  it('issues a token that expires in 7 days (not 30)', async () => {
    mockVerifyApple.mockResolvedValue({ sub: 'apple-sub-expiry', name: 'Expiry Test', email: null });

    const res = await request(app).post('/auth/apple').send({ idToken: 'token' });
    expect(res.status).toBe(200);

    const decoded = jwt.decode(res.body.token) as { exp: number; iat: number };
    const lifetimeSeconds = decoded.exp - decoded.iat;
    // 7 days = 604800s. Allow ±5s for test execution time.
    expect(lifetimeSeconds).toBeGreaterThanOrEqual(604795);
    expect(lifetimeSeconds).toBeLessThanOrEqual(604805);
  });
});

describe('POST /auth/logout', () => {
  it('clears the apns_token of the authenticated user and returns 204', async () => {
    mockVerifyApple.mockResolvedValueOnce({ sub: 'apple-sub-logout', name: 'Logout User', email: null });
    const loginRes = await request(app)
      .post('/auth/apple')
      .send({ idToken: 'token', apnsToken: 'device-logout-token' });
    expect(loginRes.status).toBe(200);

    const logoutRes = await request(app)
      .post('/auth/logout')
      .set({ Authorization: `Bearer ${loginRes.body.token}` });
    expect(logoutRes.status).toBe(204);

    const { rows } = await pool.query(
      `SELECT apns_token FROM users WHERE apple_sub = 'apple-sub-logout'`
    );
    expect(rows[0].apns_token).toBeNull();
  });

  it('returns 401 when no token is provided', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(401);
  });
});
