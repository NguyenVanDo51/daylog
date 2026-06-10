import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, createTestAlbumMember, authHeader } from '../../tests/setup';

// app.js is still JS — use require to skirt allowJs.
const app = require('../app');

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

describe('Albums CRUD', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('POST /albums creates an album and adds creator as admin member', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: "Emma's Album", child_birthdate: '2024-03-01' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Emma's Album");
    expect(res.body.child_birthdate).toMatch(/2024-03-01/);
  });

  it('GET /albums returns albums the user is a member of', async () => {
    await createTestAlbum(user.id, { name: 'Album A' });
    await createTestAlbum(user.id, { name: 'Album B' });

    const res = await request(app).get('/albums').set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('GET /albums/:id returns album with member count', async () => {
    const album = await createTestAlbum(user.id);

    const res = await request(app).get(`/albums/${album.id}`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(album.id);
    expect(res.body.member_count).toBe(1);
  });

  it('GET /albums/:id returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-sub' });
    const album = await createTestAlbum(other.id);

    const res = await request(app).get(`/albums/${album.id}`).set(headers);

    expect(res.status).toBe(403);
  });

  it('PATCH /albums/:id updates name and child_birthdate', async () => {
    const album = await createTestAlbum(user.id);

    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({ name: 'New Name', child_birthdate: '2024-06-15' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });
});

describe('Albums error paths and edge cases', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('POST /albums with invalid child_birthdate format returns 500 (DB error -> catch/rollback)', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: 'Bad Date Album', child_birthdate: 'not-a-real-date' });

    expect(res.status).toBe(500);
  });

  it('POST /albums without name returns 400', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('name required');
  });

  it('GET /albums/:id returns 403 when caller has no membership (even for nonexistent id)', async () => {
    // Random UUID that doesn't exist; membership check fails first -> 403.
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request(app).get(`/albums/${fakeId}`).set(headers);

    expect(res.status).toBe(403);
  });

  it('PATCH /albums/:id by non-member returns 403', async () => {
    const other = await createTestUser({ apple_sub: 'patch-other-sub' });
    const album = await createTestAlbum(other.id);

    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({ name: 'Hacked Name' });

    expect(res.status).toBe(403);
  });

  it('PATCH /albums/:id returns 403 when caller is a member but not admin', async () => {
    const album = await createTestAlbum(user.id);
    const member = await createTestUser({ apple_sub: 'member-patch' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(authHeader(member))
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(403);
  });

  it('PATCH /albums/:id with cover_photo_id from a different album returns 400', async () => {
    const albumA = await createTestAlbum(user.id, { name: 'Album A' });
    const albumB = await createTestAlbum(user.id, { name: 'Album B' });

    const { rows: [photo] } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, thumbnail_key, taken_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [albumB.id, user.id, 'r2-key-b', 'thumb-key-b', new Date().toISOString()]
    );

    const res = await request(app)
      .patch(`/albums/${albumA.id}`)
      .set(headers)
      .send({ cover_photo_id: photo.id });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('cover_photo_id does not belong to this album');
  });

  it('PATCH /albums/:id with cover_photo_id from same album returns 200 and updates cover', async () => {
    const album = await createTestAlbum(user.id, { name: 'Cover Album' });

    const { rows: [photo] } = await pool.query(
      `INSERT INTO photos (album_id, uploaded_by, r2_key, thumbnail_key, taken_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [album.id, user.id, 'r2-key-cover', 'thumb-key-cover', new Date().toISOString()]
    );

    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({ cover_photo_id: photo.id });

    expect(res.status).toBe(200);
    expect(res.body.cover_photo_id).toBe(photo.id);
  });

  it('PATCH /albums/:id with empty body returns 200 with album unchanged (COALESCE branches)', async () => {
    const album = await createTestAlbum(user.id, { name: 'Unchanged Album' });

    const res = await request(app)
      .patch(`/albums/${album.id}`)
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(album.id);
    expect(res.body.name).toBe('Unchanged Album');
  });

  it('GET /albums/:id returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app).get('/albums/not-a-uuid').set(headers);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  it('PATCH /albums/:id returns 400 when albumId is not a valid UUID', async () => {
    const res = await request(app)
      .patch('/albums/not-a-uuid')
      .set(headers)
      .send({ name: 'whatever' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid albumId/);
  });

  it('POST /albums without child_birthdate falls back to null (binary-expr branch)', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: 'No Birthdate Album' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('No Birthdate Album');
    expect(res.body.child_birthdate).toBeNull();
  });
});

describe('Albums is_private', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('POST /albums returns is_private=false by default', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: 'My Album' });

    expect(res.status).toBe(201);
    expect(res.body.is_private).toBe(false);
  });

  it('POST /albums with is_private:true creates a private album', async () => {
    const res = await request(app)
      .post('/albums')
      .set(headers)
      .send({ name: 'Personal', is_private: true });

    expect(res.status).toBe(201);
    expect(res.body.is_private).toBe(true);
  });

  it('POST /albums with is_private:true returns 400 when private album already exists', async () => {
    await request(app).post('/albums').set(headers).send({ name: 'First', is_private: true });
    const res = await request(app).post('/albums').set(headers).send({ name: 'Second', is_private: true });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Private album already exists');
  });

  it('GET /albums returns is_private field on each album', async () => {
    await createTestAlbum(user.id, { name: 'Shared' });
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(typeof res.body[0].is_private).toBe('boolean');
  });
});

describe('Albums my_role and archived_at fields', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('GET /albums returns my_role for each album', async () => {
    await createTestAlbum(user.id, { name: 'Mine' });
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].my_role).toBe('admin');
  });

  it('GET /albums returns archived_at as null for active albums', async () => {
    await createTestAlbum(user.id);
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].archived_at).toBeNull();
  });

  it('GET /albums returns archived_at as ISO string for archived albums', async () => {
    await createTestAlbum(user.id, { archived: true });
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].archived_at).toBeTruthy();
  });

  it('GET /albums/:id returns my_role', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.my_role).toBe('admin');
  });

  it('GET /albums/:id returns archived_at', async () => {
    const album = await createTestAlbum(user.id, { archived: true });
    const res = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeTruthy();
  });

  it('GET /albums returns my_role as member when user is not the creator', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-sub' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app).get('/albums').set(headers);
    expect(res.status).toBe(200);
    expect(res.body[0].my_role).toBe('member');
  });
});

describe('DELETE /albums/:id', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 204 and removes the album', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(check.status).toBe(403);
  });

  it('returns 403 for non-admin member', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-del-2' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-del-3' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .delete(`/albums/${album.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent album', async () => {
    const res = await request(app)
      .delete('/albums/00000000-0000-0000-0000-000000000000')
      .set(headers);
    expect(res.status).toBe(404);
  });
});

describe('DELETE /albums/:id/members/me', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 204 and removes the caller from album_members', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);

    // User can no longer access the album
    const check = await request(app).get(`/albums/${album.id}`).set(headers);
    expect(check.status).toBe(403);
  });

  it('allows the last admin to leave (album becomes admin-less)', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'leave-other' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('a regular member can leave', async () => {
    const creator = await createTestUser({ apple_sub: 'leave-creator' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .delete(`/albums/${album.id}/members/me`)
      .set(headers);
    expect(res.status).toBe(204);
  });
});

describe('POST /albums/:id/archive', () => {
  let user: any;
  let headers: Record<string, string>;

  beforeEach(async () => {
    user = await createTestUser();
    headers = authHeader(user);
  });

  it('returns 200 and sets archived_at', async () => {
    const album = await createTestAlbum(user.id);
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.archived_at).toBeTruthy();
  });

  it('returns 403 for non-admin member', async () => {
    const creator = await createTestUser({ apple_sub: 'creator-2' });
    const album = await createTestAlbum(creator.id);
    await createTestAlbumMember(album.id, user.id, 'member');
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-member', async () => {
    const other = await createTestUser({ apple_sub: 'other-3' });
    const album = await createTestAlbum(other.id);
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 409 if already archived', async () => {
    const album = await createTestAlbum(user.id, { archived: true });
    const res = await request(app)
      .post(`/albums/${album.id}/archive`)
      .set(headers);
    expect(res.status).toBe(409);
  });
});
