import request from 'supertest';
const app = require('../app');
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader, TestUser, TestAlbum } from '../../tests/setup';

describe('GET /albums/:id/members', () => {
  let user: TestUser;
  let album: TestAlbum;
  let headers: { Authorization: string };

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
    const names = res.body.map((m: { display_name: string }) => m.display_name);
    expect(names).toContain('Grandma');
    expect(res.body[0].role).toBeDefined();
  });

  it('returns 403 for non-members', async () => {
    const stranger = await createTestUser({ apple_sub: 'stranger' });
    const res = await request(app).get(`/albums/${album.id}/members`).set(authHeader(stranger));
    expect(res.status).toBe(403);
  });

  it('returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app).get('/albums/not-a-uuid/members').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  it('returns members ordered by joined_at ASC', async () => {
    const earlier = new Date(Date.now() - 60_000).toISOString();
    const later = new Date().toISOString();

    // Reset the creator's joined_at to a known earlier time
    await pool.query(
      `UPDATE album_members SET joined_at = $1 WHERE album_id = $2 AND user_id = $3`,
      [earlier, album.id, user.id]
    );

    const member = await createTestUser({ apple_sub: 'member-order', display_name: 'LaterMember' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role, joined_at) VALUES ($1, $2, 'member', $3)`,
      [album.id, member.id, later]
    );

    const res = await request(app).get(`/albums/${album.id}/members`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(user.id);
    expect(res.body[1].id).toBe(member.id);
    expect(new Date(res.body[0].joined_at).getTime())
      .toBeLessThan(new Date(res.body[1].joined_at).getTime());
  });

  it('returns admin and member roles correctly', async () => {
    const member = await createTestUser({ apple_sub: 'role-member', display_name: 'RoleMember' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );

    const res = await request(app).get(`/albums/${album.id}/members`).set(headers);

    expect(res.status).toBe(200);
    const byId = Object.fromEntries(res.body.map((m: { id: string }) => [m.id, m]));
    expect(byId[user.id].role).toBe('admin');
    expect(byId[member.id].role).toBe('member');
  });
});
