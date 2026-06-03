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
