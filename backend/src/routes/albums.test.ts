import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

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
