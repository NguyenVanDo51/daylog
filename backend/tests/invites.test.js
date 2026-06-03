const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

describe('Invites', () => {
  let user, album, headers;

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
    const { pool } = require('../src/db/client');
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

    const { pool } = require('../src/db/client');
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
});
