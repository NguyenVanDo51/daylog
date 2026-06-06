import request from 'supertest';
const app = require('../app');
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader, TestUser, TestAlbum } from '../../tests/setup';

describe('Invites', () => {
  let user: TestUser;
  let album: TestAlbum;
  let headers: { Authorization: string };

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('POST /albums/:id/invites returns a token and QR code', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(headers)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.deep_link).toMatch(/^familyguy:\/\/join\//);
    expect(res.body.qr_code).toMatch(/^data:image\/png;base64,/);
  });

  it('GET /invites/:token returns album info for valid token', async () => {
    const invite = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const { token } = invite.body;

    const res = await request(app).get(`/invites/${token}`);

    expect(res.status).toBe(200);
    expect(res.body.album_id).toBe(album.id);
    expect(res.body.album_name).toBeDefined();
  });

  it('GET /invites/:token returns 410 for expired token', async () => {
    await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at) VALUES ($1, $2, $3, $4)`,
      [album.id, 'expired-token', user.id, new Date(Date.now() - 1000).toISOString()]
    );

    const res = await request(app).get(`/invites/expired-token`);
    expect(res.status).toBe(410);
  });

  it('POST /invites/:token/join adds user to album', async () => {
    const inviter = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const { token } = inviter.body;

    const newUser = await createTestUser({ apple_sub: 'new-member' });
    const res = await request(app)
      .post(`/invites/${token}/join`)
      .set(authHeader(newUser));

    expect(res.status).toBe(200);
    expect(res.body.album_id).toBe(album.id);

    const { rows } = await pool.query(
      'SELECT * FROM album_members WHERE album_id = $1 AND user_id = $2',
      [album.id, newUser.id]
    );
    expect(rows).toHaveLength(1);
  });

  it('POST /invites/:token/join is idempotent — rejoining returns 200', async () => {
    const inviter = await request(app).post(`/albums/${album.id}/invites`).set(headers).send({});
    const newUser = await createTestUser({ apple_sub: 'new-member' });
    await request(app).post(`/invites/${inviter.body.token}/join`).set(authHeader(newUser));
    const res = await request(app).post(`/invites/${inviter.body.token}/join`).set(authHeader(newUser));
    expect(res.status).toBe(200);
  });

  it('POST /albums/:id/invites by non-member returns 403', async () => {
    const outsider = await createTestUser({ apple_sub: 'outsider' });
    const res = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(authHeader(outsider))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('POST /albums/:id/invites with expires_in_days sets expires_at to now + days', async () => {
    const days = 7;
    const before = Date.now();
    const res = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(headers)
      .send({ expires_in_days: days });

    expect(res.status).toBe(201);
    expect(res.body.expires_at).toBeDefined();
    const expectedMs = before + days * 86400000;
    const actualMs = new Date(res.body.expires_at).getTime();
    expect(Math.abs(actualMs - expectedMs)).toBeLessThan(10000);
  });

  it('POST /albums/:id/invites without expires_in_days defaults to 7 days expiry', async () => {
    const before = Date.now();
    const res = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(headers)
      .send({});

    expect(res.status).toBe(201);
    const expiresAt = new Date(res.body.expires_at).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 6 * 86400000);
    expect(expiresAt).toBeLessThanOrEqual(before + 8 * 86400000);

    const { rows } = await pool.query(
      'SELECT expires_at, max_uses FROM invites WHERE token = $1',
      [res.body.token]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].expires_at).not.toBeNull();
    expect(rows[0].max_uses).toBe(1000);
  });

  it('POST /albums/:id/invites returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .post(`/albums/not-a-uuid/invites`)
      .set(headers)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  it('GET /invites/:token returns 404 for nonexistent token', async () => {
    const res = await request(app).get('/invites/this-token-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('GET /invites/:token returns 410 when use limit reached', async () => {
    await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at, max_uses, use_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [album.id, 'limit-token', user.id, null, 2, 2]
    );

    const res = await request(app).get('/invites/limit-token');
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Invite limit reached');
  });

  it('POST /invites/:token/join returns 404 for nonexistent token', async () => {
    const res = await request(app)
      .post('/invites/no-such-token/join')
      .set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('POST /invites/:token/join returns 410 for expired invite', async () => {
    await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at, max_uses, use_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [album.id, 'expired-join-token', user.id, new Date(Date.now() - 86400000).toISOString(), null, 0]
    );

    const newUser = await createTestUser({ apple_sub: 'expired-joiner' });
    const res = await request(app)
      .post('/invites/expired-join-token/join')
      .set(authHeader(newUser));
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Invite expired');
  });

  it('POST /invites/:token/join returns 410 when use limit reached', async () => {
    await pool.query(
      `INSERT INTO invites (album_id, token, created_by, expires_at, max_uses, use_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [album.id, 'maxed-join-token', user.id, null, 1, 1]
    );

    const newUser = await createTestUser({ apple_sub: 'maxed-joiner' });
    const res = await request(app)
      .post('/invites/maxed-join-token/join')
      .set(authHeader(newUser));
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('Invite limit reached');
  });

  it('POST /invites/:token/join twice by same user only increments use_count once', async () => {
    const inviter = await request(app)
      .post(`/albums/${album.id}/invites`)
      .set(headers)
      .send({});
    const { token } = inviter.body;

    const newUser = await createTestUser({ apple_sub: 'double-joiner' });
    const first = await request(app).post(`/invites/${token}/join`).set(authHeader(newUser));
    expect(first.status).toBe(200);
    const second = await request(app).post(`/invites/${token}/join`).set(authHeader(newUser));
    expect(second.status).toBe(200);

    const { rows } = await pool.query('SELECT use_count FROM invites WHERE token = $1', [token]);
    expect(rows[0].use_count).toBe(1);
  });

  it('POST /albums/:id/invites returns 403 for a private album', async () => {
    const res1 = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: 'My Photos', is_private: true });
    const privateAlbumId = res1.body.id;

    const res = await request(app)
      .post(`/albums/${privateAlbumId}/invites`)
      .set(headers)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot invite to a private album');
  });

  describe('POST /albums/:albumId/invites — param validation', () => {
    it('returns 400 when expires_in_days is 0', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ expires_in_days: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expires_in_days must be a positive integer/);
    });

    it('returns 400 when expires_in_days is negative', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ expires_in_days: -5 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when max_uses is 0', async () => {
      const res = await request(app)
        .post(`/albums/${album.id}/invites`)
        .set(authHeader(user))
        .send({ max_uses: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/max_uses must be a positive integer/);
    });
  });
});
