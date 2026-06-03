import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requireAuth } from './auth';
import { createTestUser } from '../../tests/setup';

function buildApp() {
  const app = express();
  app.get('/probe', requireAuth, (req, res) => {
    res.json({ userId: req.user!.id, displayName: req.user!.displayName });
  });
  return app;
}

describe('requireAuth middleware', () => {
  it('returns 401 when no Authorization header is present', async () => {
    const res = await request(buildApp()).get('/probe');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when Authorization header lacks the Bearer prefix', async () => {
    const res = await request(buildApp())
      .get('/probe')
      .set('Authorization', 'Token abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 500 when JWT_SECRET is not configured on the server', async () => {
    const originalSecret = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const res = await request(buildApp())
        .get('/probe')
        .set('Authorization', 'Bearer anything');
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Server misconfigured' });
    } finally {
      if (originalSecret !== undefined) process.env.JWT_SECRET = originalSecret;
    }
  });

  it('returns 401 when the JWT signature is invalid', async () => {
    const badToken = jwt.sign({ userId: 'whatever' }, 'a-completely-different-secret');
    const res = await request(buildApp())
      .get('/probe')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when the JWT is malformed garbage', async () => {
    const res = await request(buildApp())
      .get('/probe')
      .set('Authorization', 'Bearer not-a-real-jwt');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when the token is valid but the user no longer exists', async () => {
    const secret = process.env.JWT_SECRET || 'test-secret';
    const ghostToken = jwt.sign(
      { userId: '00000000-0000-0000-0000-000000000000' },
      secret
    );
    const res = await request(buildApp())
      .get('/probe')
      .set('Authorization', `Bearer ${ghostToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('calls next() and exposes the user on req when given a valid token for an existing user', async () => {
    const user = await createTestUser({ display_name: 'Middleware Tester' });
    const secret = process.env.JWT_SECRET || 'test-secret';
    const token = jwt.sign({ userId: user.id }, secret);

    const res = await request(buildApp())
      .get('/probe')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(user.id);
    expect(res.body.displayName).toBe('Middleware Tester');
  });
});
