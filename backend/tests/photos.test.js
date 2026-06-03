const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/client');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

jest.mock('../src/services/r2');
jest.mock('../src/services/thumbnail');
jest.mock('../src/services/apns');

const { getPresignedPutUrl } = require('../src/services/r2');
const { generateThumbnail } = require('../src/services/thumbnail');
const { sendPush } = require('../src/services/apns');

describe('POST /photos/presign', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    getPresignedPutUrl.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
  });

  it('returns a presigned URL and r2 key', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id });

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://r2.example.com/presigned');
    expect(res.body.key).toBe('photos/abc.webp');
  });

  it('returns 403 when user is not album member', async () => {
    const other = await createTestUser({ apple_sub: 'other' });
    const otherAlbum = await createTestAlbum(other.id);

    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: otherAlbum.id });

    expect(res.status).toBe(403);
  });
});

describe('POST /photos', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    generateThumbnail.mockResolvedValue('thumbnails/abc-thumb.webp');
    sendPush.mockResolvedValue();
  });

  it('registers a photo and returns it with thumbnail_key', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/abc.webp',
        taken_at: '2024-06-01T10:00:00Z',
        caption: 'First smile!',
        local_asset_id: 'ios-asset-uuid-123',
      });

    expect(res.status).toBe(201);
    expect(res.body.r2_key).toBe('photos/abc.webp');
    expect(res.body.thumbnail_key).toBe('thumbnails/abc-thumb.webp');
    expect(generateThumbnail).toHaveBeenCalledWith('photos/abc.webp');
  });

  it('is idempotent — same local_asset_id returns existing photo', async () => {
    const payload = { album_id: album.id, r2_key: 'photos/abc.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'same-asset' };
    await request(app).post('/photos').set(headers).send(payload);
    const res = await request(app).post('/photos').set(headers).send(payload);

    expect(res.status).toBe(200);
    const { pool: db } = require('../src/db/client');
    const { rows } = await db.query('SELECT * FROM photos WHERE local_asset_id = $1', ['same-asset']);
    expect(rows).toHaveLength(1);
  });

  it('sends push notification to all album members', async () => {
    const member = await createTestUser({ apple_sub: 'member-sub' });
    await pool.query(
      `INSERT INTO album_members (album_id, user_id, role) VALUES ($1, $2, 'member')`,
      [album.id, member.id]
    );
    await pool.query(`UPDATE users SET apns_token = 'token-abc' WHERE id = $1`, [member.id]);

    await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(sendPush).toHaveBeenCalledWith(
      ['token-abc'],
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });
});
