const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

describe('GET /albums/:id/members', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns list of album members with role', async () => {
    const member = await createTestUser({ apple_sub: 'member-sub', display_name: 'Grandma' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );

    const res = await request(app).get(`/albums/${album.id}/members`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map(m => m.display_name);
    expect(names).toContain('Grandma');
    expect(res.body[0].role).toBeDefined();
  });

  it('returns 403 for non-members', async () => {
    const stranger = await createTestUser({ apple_sub: 'stranger' });
    const res = await request(app).get(`/albums/${album.id}/members`).set(authHeader(stranger));
    expect(res.status).toBe(403);
  });
});
