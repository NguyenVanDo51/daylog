import request from 'supertest';
const app = require('../app');
import { pool } from '../db';

describe('POST /waitlist', () => {
  afterEach(async () => {
    await pool.query("DELETE FROM waitlist WHERE email LIKE 'wl-test-%'");
  });

  it('returns 201 and { message: "ok" } for a valid email', async () => {
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-1@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('ok');
  });

  it('returns 409 for a duplicate email', async () => {
    await request(app).post('/waitlist').send({ email: 'wl-test-2@example.com' });
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-2@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('already_registered');
  });

  it('returns 400 for a missing email', async () => {
    const res = await request(app).post('/waitlist').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('returns 400 for an email without @', async () => {
    const res = await request(app).post('/waitlist').send({ email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_email');
  });

  it('normalizes email to lowercase before storing', async () => {
    await request(app).post('/waitlist').send({ email: 'WL-TEST-3@EXAMPLE.COM' });
    const row = await pool.query(
      "SELECT email FROM waitlist WHERE email = 'wl-test-3@example.com'"
    );
    expect(row.rows[0]?.email).toBe('wl-test-3@example.com');
  });

  it('does not require an Authorization header', async () => {
    const res = await request(app)
      .post('/waitlist')
      .send({ email: 'wl-test-4@example.com' });
    expect(res.status).not.toBe(401);
  });
});
