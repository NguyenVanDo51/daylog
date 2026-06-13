import request from 'supertest';
import { db } from '../db';
import { feedback } from '../db/schema';
import { eq } from 'drizzle-orm';
import { createTestUser, authHeader } from '../../tests/setup';
const app = require('../app');

describe('POST /feedback', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).post('/feedback').send({ rating: 5 });
    expect(res.status).toBe(401);
  });

  it('returns 400 when rating is missing', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is below 1', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 0 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is above 5', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 6 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when rating is not an integer', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 3.5 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when message exceeds 2000 chars', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 5, message: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('inserts a row and returns 204 with rating only', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 4 });
    expect(res.status).toBe(204);

    const rows = await db.select().from(feedback).where(eq(feedback.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(4);
    expect(rows[0].message).toBeNull();
    expect(rows[0].appVersion).toBeNull();
    expect(rows[0].platform).toBeNull();
  });

  it('inserts a row with rating + message + app_version + platform', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 2, message: 'Crash on upload', app_version: '0.1.0', platform: 'ios' });
    expect(res.status).toBe(204);

    const rows = await db.select().from(feedback).where(eq(feedback.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].message).toBe('Crash on upload');
    expect(rows[0].appVersion).toBe('0.1.0');
    expect(rows[0].platform).toBe('ios');
  });

  it('normalises a whitespace-only message to null', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 5, message: '   \n  ' });
    expect(res.status).toBe(204);

    const rows = await db.select().from(feedback).where(eq(feedback.userId, user.id));
    expect(rows[0].message).toBeNull();
  });

  it('returns 400 when platform is not in the enum', async () => {
    const user = await createTestUser();
    const res = await request(app)
      .post('/feedback')
      .set(authHeader(user))
      .send({ rating: 5, platform: 'windows' });
    expect(res.status).toBe(400);
  });
});
