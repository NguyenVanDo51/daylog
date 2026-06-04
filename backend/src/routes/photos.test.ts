jest.mock('../services/r2', () => ({ getPresignedPutUrl: jest.fn() }));
jest.mock('../services/thumbnail', () => ({ generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb_key', width: 800, height: 600 }) }));
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
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/abc-thumb.webp', width: 800, height: 600 });
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
    expect(res.body.width).toBeDefined();
    expect(res.body.height).toBeDefined();
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

// --- New tests for content_type presign ---

describe('POST /photos/presign — content_type', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockPresign.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.mp4' });
  });

  it('accepts content_type video/mp4', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id, content_type: 'video/mp4' });
    expect(res.status).toBe(200);
    expect(mockPresign).toHaveBeenCalledWith('video/mp4');
  });

  it('accepts content_type image/jpeg', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id, content_type: 'image/jpeg' });
    expect(res.status).toBe(200);
    expect(mockPresign).toHaveBeenCalledWith('image/jpeg');
  });

  it('rejects unknown content_type', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id, content_type: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content_type/);
  });

  it('defaults to image/webp when content_type is omitted', async () => {
    mockPresign.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({ album_id: album.id });
    expect(res.status).toBe(200);
    expect(mockPresign).toHaveBeenCalledWith('image/webp');
  });
});

// --- New tests for POST /photos capture fields ---

describe('POST /photos — capture fields', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue({ key: 'thumb_key', width: 800, height: 600 });
    mockSendPush.mockResolvedValue(undefined);
  });

  it('creates a capture photo and returns source + media_type', async () => {
    await createPresignToken(user.id, 'key-capture-photo');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-capture-photo',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'photo',
      });
    expect(res.status).toBe(201);
    expect(res.body.source).toBe('capture');
    expect(res.body.media_type).toBe('photo');
  });

  it('creates a capture video with duration_ms and thumbnail_r2_key', async () => {
    await createPresignToken(user.id, 'key-video');
    await createPresignToken(user.id, 'key-video-thumb');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-video',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'video',
        duration_ms: 1800,
        thumbnail_r2_key: 'key-video-thumb',
      });
    expect(res.status).toBe(201);
    expect(res.body.media_type).toBe('video');
    expect(res.body.duration_ms).toBe(1800);
    expect(res.body.thumbnail_key).toBe('key-video-thumb');
  });

  it('stores width and height for video uploads', async () => {
    await createPresignToken(user.id, 'key-video-dims');
    await createPresignToken(user.id, 'key-video-dims-thumb');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-video-dims',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'video',
        duration_ms: 1200,
        thumbnail_r2_key: 'key-video-dims-thumb',
        width: 1920,
        height: 1080,
      });
    expect(res.status).toBe(201);
    expect(res.body.width).toBe(1920);
    expect(res.body.height).toBe(1080);
  });

  it('rejects video missing duration_ms', async () => {
    await createPresignToken(user.id, 'key-vid2');
    await createPresignToken(user.id, 'key-vid2-thumb');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-vid2',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'video',
        thumbnail_r2_key: 'key-vid2-thumb',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration_ms/);
  });

  it('rejects video with duration_ms > 2000', async () => {
    await createPresignToken(user.id, 'key-vid3');
    await createPresignToken(user.id, 'key-vid3-thumb');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-vid3',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'video',
        duration_ms: 3000,
        thumbnail_r2_key: 'key-vid3-thumb',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/duration_ms/);
  });

  it('rejects video missing thumbnail_r2_key', async () => {
    await createPresignToken(user.id, 'key-vid4');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-vid4',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'video',
        duration_ms: 1000,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/thumbnail_r2_key/);
  });

  it('sends capture push with Vietnamese title and body', async () => {
    await createPresignToken(user.id, 'key-capture-push');
    await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-capture-push',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'photo',
      });
    expect(mockSendPush).toHaveBeenCalledWith(
      expect.any(Array),
      'Khoảnh khắc mới',
      expect.stringContaining('vừa gửi'),
      expect.any(Object)
    );
  });

  it('enforces 30-minute rate limit on captures', async () => {
    // First capture — should succeed
    await createPresignToken(user.id, 'key-rl-1');
    const first = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-rl-1',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'photo',
      });
    expect(first.status).toBe(201);

    // Second capture immediately — should 429
    await createPresignToken(user.id, 'key-rl-2');
    const second = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-rl-2',
        taken_at: new Date().toISOString(),
        source: 'capture',
        media_type: 'photo',
      });
    expect(second.status).toBe(429);
    expect(second.body.error).toBe('rate_limited');
    expect(second.body.retry_after_seconds).toBeGreaterThan(0);
  });

  it('does NOT rate-limit source=upload', async () => {
    await createPresignToken(user.id, 'key-upload-notlimited');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_id: album.id,
        r2_key: 'key-upload-notlimited',
        taken_at: new Date().toISOString(),
        source: 'upload',
        media_type: 'photo',
      });
    expect(res.status).toBe(201);
  });
});
