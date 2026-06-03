const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');

jest.mock('../src/services/appleAuth');
jest.mock('../src/services/googleAuth');

const { verifyAppleToken } = require('../src/services/appleAuth');
const { verifyGoogleToken } = require('../src/services/googleAuth');

describe('POST /auth/apple', () => {
  it('creates a new user and returns a JWT', async () => {
    verifyAppleToken.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: 'jane@example.com' });

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
    verifyAppleToken.mockResolvedValue({ sub: 'apple-sub-123', name: 'Jane Doe', email: null });

    await request(app).post('/auth/apple').send({ idToken: 'token' });
    const res = await request(app).post('/auth/apple').send({ idToken: 'token' });

    expect(res.status).toBe(200);
    const { rows } = await pool.query(`SELECT * FROM users WHERE apple_sub = 'apple-sub-123'`);
    expect(rows).toHaveLength(1);
  });

  it('returns 400 when idToken is missing', async () => {
    const res = await request(app).post('/auth/apple').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/google', () => {
  it('creates a new user and returns a JWT', async () => {
    verifyGoogleToken.mockResolvedValue({ sub: 'google-sub-456', name: 'John Smith', picture: 'https://example.com/photo.jpg' });

    const res = await request(app)
      .post('/auth/google')
      .send({ idToken: 'fake-google-token', apnsToken: 'device-token-xyz' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.display_name).toBe('John Smith');
  });
});
