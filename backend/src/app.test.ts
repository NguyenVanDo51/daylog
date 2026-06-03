import request from 'supertest';

// Mock the albums route to expose endpoints that trigger the global error handler.
jest.mock('./routes/albums', () => {
  const router = require('express').Router();
  router.get('/__boom', (req: any, res: any, next: any) => {
    const e: any = new Error('boom');
    e.status = 418;
    next(e);
  });
  router.get('/__silent_boom', (req: any, res: any, next: any) => {
    next(new Error('silent'));
  });
  router.get('/__no_msg', (req: any, res: any, next: any) => {
    next(new Error(''));
  });
  return router;
});

const app = require('./app');

describe('global error handler (src/app.js)', () => {
  it('returns err.status and err.message when both are set', async () => {
    const res = await request(app).get('/albums/__boom');
    expect(res.status).toBe(418);
    expect(res.body).toEqual({ error: 'boom' });
  });

  it('falls back to status 500 when err has no status', async () => {
    const res = await request(app).get('/albums/__silent_boom');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'silent' });
  });

  it('uses default error message when err.message is empty', async () => {
    const res = await request(app).get('/albums/__no_msg');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });
});
