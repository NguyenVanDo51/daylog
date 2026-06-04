jest.mock('../services/r2', () => ({ getPresignedPutUrl: jest.fn() }));
jest.mock('../services/thumbnail', () => ({ generateThumbnail: jest.fn().mockResolvedValue('thumb_key') }));
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, createPresignToken, authHeader } from '../../tests/setup';
const app = require('../app');

import { getPresignedPutUrl } from '../services/r2';
import { generateThumbnail } from '../services/thumbnail';
import { sendPush } from '../services/apns';

const mockPresign = getPresignedPutUrl as jest.Mock;
const mockGenThumb = generateThumbnail as jest.Mock;
const mockSendPush = sendPush as jest.Mock;

describe('POST /photos/presign', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockPresign.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
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

  it('returns 400 when album_id is missing', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_id required/);
  });

  it('returns 400 when album_id is not a valid UUID', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid UUID/);
  });

  it('forwards errors to next() when getPresignedPutUrl rejects', async () => {
    mockPresign.mockRejectedValueOnce(new Error('r2 down'));

    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id });

    expect(res.status).toBe(500);
  });
});

describe('POST /photos', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue('thumbnails/abc-thumb.webp');
    mockSendPush.mockResolvedValue(undefined);
  });

  it('registers a photo and returns it with thumbnail_key', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');  // seed presign token
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
    expect(mockGenThumb).toHaveBeenCalledWith('photos/abc.webp');
  });

  it('is idempotent — same local_asset_id returns existing photo', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');  // seed presign token (only one needed — second call hits idempotency return)
    const payload = { album_id: album.id, r2_key: 'photos/abc.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'same-asset' };
    await request(app).post('/photos').set(headers).send(payload);
    const res = await request(app).post('/photos').set(headers).send(payload);

    expect(res.status).toBe(200);
    const { rows } = await pool.query('SELECT * FROM photos WHERE local_asset_id = $1', ['same-asset']);
    expect(rows).toHaveLength(1);
  });

  it('sends push notification to all album members', async () => {
    await createPresignToken(user.id, 'photos/x.webp');  // seed presign token
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

    expect(mockSendPush).toHaveBeenCalledWith(
      ['token-abc'],
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('returns 400 when album_id is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_id, r2_key, taken_at required/);
  });

  it('returns 400 when r2_key is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_id, r2_key, taken_at required/);
  });

  it('returns 400 when taken_at is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/x.webp' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_id, r2_key, taken_at required/);
  });

  it('returns 400 when album_id is not a valid UUID', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: 'not-a-uuid', r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/valid UUID/);
  });

  it('returns 403 when user is not album member', async () => {
    const other = await createTestUser({ apple_sub: 'other-photos' });
    const otherAlbum = await createTestAlbum(other.id);

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: otherAlbum.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(403);
  });

  it('inserts a new photo when local_asset_id is provided but no existing row matches', async () => {
    await createPresignToken(user.id, 'photos/new-asset.webp');  // seed presign token
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/new-asset.webp',
        taken_at: '2024-06-01T10:00:00Z',
        local_asset_id: 'brand-new-asset',
      });

    expect(res.status).toBe(201);
    expect(res.body.local_asset_id).toBe('brand-new-asset');
    expect(mockGenThumb).toHaveBeenCalledWith('photos/new-asset.webp');
  });

  it('inserts a new photo when local_asset_id is omitted', async () => {
    await createPresignToken(user.id, 'photos/no-asset.webp');  // seed presign token
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/no-asset.webp',
        taken_at: '2024-06-01T10:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.local_asset_id).toBeNull();
    expect(mockGenThumb).toHaveBeenCalledWith('photos/no-asset.webp');
  });

  it('forwards errors to next() when generateThumbnail rejects', async () => {
    await createPresignToken(user.id, 'photos/x.webp');  // seed presign token
    mockGenThumb.mockRejectedValueOnce(new Error('boom'));

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(500);
  });

  it('calls sendPush with empty array when no other members have apns_token', async () => {
    await createPresignToken(user.id, 'photos/solo.webp');  // seed presign token
    await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_id: album.id, r2_key: 'photos/solo.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(mockSendPush).toHaveBeenCalledWith(
      [],
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('returns 400 when r2_key was not issued to this user via presign', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/not-presigned.webp',
        taken_at: '2024-06-01T10:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid or unrecognized r2_key/);
  });

  it('returns 400 when r2_key was issued to a different user', async () => {
    const other = await createTestUser({ apple_sub: 'other-presign' });
    await createPresignToken(other.id, 'photos/other-key.webp');

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'photos/other-key.webp',
        taken_at: '2024-06-01T10:00:00Z',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid or unrecognized r2_key/);
  });
});
