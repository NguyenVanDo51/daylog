const request = require('supertest');
const app = require('../src/app');

describe('Auth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/albums');
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    const res = await request(app)
      .get('/albums')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });
});
