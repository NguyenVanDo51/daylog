const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

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
  let user, headers;

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
