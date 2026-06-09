import request from 'supertest';
const app = require('../app');

describe('GET /version', () => {
  const originalMin = process.env.MIN_APP_VERSION;
  const originalLatest = process.env.LATEST_APP_VERSION;

  afterEach(() => {
    process.env.MIN_APP_VERSION = originalMin;
    process.env.LATEST_APP_VERSION = originalLatest;
  });

  it('returns 200 with minVersion and latestVersion strings', async () => {
    const res = await request(app).get('/version');
    expect(res.status).toBe(200);
    expect(typeof res.body.minVersion).toBe('string');
    expect(typeof res.body.latestVersion).toBe('string');
  });

  it('returns default 1.0.0 when env vars are not set', async () => {
    delete process.env.MIN_APP_VERSION;
    delete process.env.LATEST_APP_VERSION;
    const res = await request(app).get('/version');
    expect(res.body.minVersion).toBe('1.0.0');
    expect(res.body.latestVersion).toBe('1.0.0');
  });

  it('returns env var values when set', async () => {
    process.env.MIN_APP_VERSION = '2.3.4';
    process.env.LATEST_APP_VERSION = '3.0.0';
    const res = await request(app).get('/version');
    expect(res.body.minVersion).toBe('2.3.4');
    expect(res.body.latestVersion).toBe('3.0.0');
  });

  it('does not require Authorization header', async () => {
    const res = await request(app).get('/version');
    expect(res.status).not.toBe(401);
  });
});
