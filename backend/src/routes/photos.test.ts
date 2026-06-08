jest.mock('../services/r2', () => ({
  getPresignedPutUrl: jest.fn(),
  getObjectBuffer: jest.fn(),
  deleteObject: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../services/thumbnail', () => ({ generateThumbnail: jest.fn().mockResolvedValue({ key: 'thumb_key', width: 800, height: 600 }) }));
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { eq } from 'drizzle-orm';
import { pool } from '../db';
import { db } from '../db';
import { photos, albumPhotos, albums } from '../db/schema';
import { createTestUser, createTestAlbum, createPresignToken, authHeader, createTestAlbumMember } from '../../tests/setup';
const app = require('../app');

import { getPresignedPutUrl } from '../services/r2';
import { getObjectBuffer } from '../services/r2';
import { deleteObject } from '../services/r2';
const mockGetObjectBuffer = getObjectBuffer as jest.Mock;
const mockDeleteObject = deleteObject as jest.Mock;
import { generateThumbnail } from '../services/thumbnail';
import { sendPush } from '../services/apns';

const mockPresign = getPresignedPutUrl as jest.Mock;
const mockGenThumb = generateThumbnail as jest.Mock;
const mockSendPush = sendPush as jest.Mock;

async function insertPhoto(
  userId: string,
  albumId: string,
  opts: { takenAt?: string; thumbnailKey?: string } = {}
) {
  const [p] = await db
    .insert(photos)
    .values({
      albumId,
      uploadedBy: userId,
      r2Key: `photos/${Math.random()}.webp`,
      thumbnailKey: opts.thumbnailKey ?? `thumbnails/${Math.random()}.webp`,
      takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
      mediaType: 'photo',
      source: 'upload',
    })
    .returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}

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

  it('returns presigned URL when album_id is omitted', async () => {
    const res = await request(app)
      .post('/photos/presign')
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://r2.example.com/presigned');
    expect(res.body.key).toBe('photos/abc.webp');
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
        album_ids: [album.id],
        r2_key: 'photos/abc.webp',
        taken_at: '2024-06-01T10:00:00Z',
        caption: 'First smile!',
        local_asset_id: 'ios-asset-uuid-123',
      });

    expect(res.status).toBe(201);
    expect(res.body.r2_key).toBe('photos/abc.webp');
    expect(res.body.thumbnail_key).toBe('thumbnails/abc-thumb.webp');
    expect(res.body.width).toBe(800);
    expect(res.body.height).toBe(600);
    expect(mockGenThumb).toHaveBeenCalledWith('photos/abc.webp');
  });

  it('is idempotent — same local_asset_id returns existing photo', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');  // seed presign token (only one needed — second call hits idempotency return)
    const payload = { album_ids: [album.id], r2_key: 'photos/abc.webp', taken_at: '2024-06-01T10:00:00Z', local_asset_id: 'same-asset' };
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
      .send({ album_ids: [album.id], r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(mockSendPush).toHaveBeenCalledWith(
      ['token-abc'],
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );
  });

  it('returns 400 when album_ids is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_ids/);
  });

  it('returns 400 when r2_key is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/r2_key/);
  });

  it('returns 400 when taken_at is missing', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/x.webp' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/taken_at/);
  });

  it('returns 403 when user is not album member', async () => {
    const other = await createTestUser({ apple_sub: 'other-photos' });
    const otherAlbum = await createTestAlbum(other.id);

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [otherAlbum.id], r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(403);
  });

  it('inserts a new photo when local_asset_id is provided but no existing row matches', async () => {
    await createPresignToken(user.id, 'photos/new-asset.webp');  // seed presign token
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_ids: [album.id],
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
        album_ids: [album.id],
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
      .send({ album_ids: [album.id], r2_key: 'photos/x.webp', taken_at: '2024-06-01T10:00:00Z' });

    expect(res.status).toBe(500);
  });

  it('calls sendPush with empty array when no other members have apns_token', async () => {
    await createPresignToken(user.id, 'photos/solo.webp');  // seed presign token
    await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/solo.webp', taken_at: '2024-06-01T10:00:00Z' });

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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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
        album_ids: [album.id],
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

});

describe('POST /photos — multi-album', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album1: Awaited<ReturnType<typeof createTestAlbum>>;
  let album2: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album1 = await createTestAlbum(user.id);
    album2 = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockPresign.mockResolvedValue({ url: 'https://r2.example.com/presigned', key: 'photos/abc.webp' });
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/abc.webp', width: 800, height: 600 });
  });

  it('creates album_photos records for each album_id', async () => {
    await createPresignToken(user.id, 'photos/abc.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_ids: [album1.id, album2.id],
        r2_key: 'photos/abc.webp',
        taken_at: new Date().toISOString(),
      });
    expect(res.status).toBe(201);

    const rows = await pool.query(
      'SELECT album_id FROM album_photos WHERE photo_id = $1 ORDER BY album_id',
      [res.body.id]
    );
    const albumIds = rows.rows.map((r: any) => r.album_id).sort();
    expect(albumIds).toEqual([album1.id, album2.id].sort());
  });

  it('returns 400 when album_ids is empty', async () => {
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [], r2_key: 'photos/abc.webp', taken_at: new Date().toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/album_ids/);
  });

  it('returns 403 when user is not a member of one of the albums', async () => {
    const other = await createTestUser({ apple_sub: 'other-' + Date.now() });
    const otherAlbum = await createTestAlbum(other.id);
    await createPresignToken(user.id, 'photos/abc.webp');

    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({
        album_ids: [album1.id, otherAlbum.id],
        r2_key: 'photos/abc.webp',
        taken_at: new Date().toISOString(),
      });
    expect(res.status).toBe(403);
  });

  it('allows immediate re-capture (no rate limit)', async () => {
    for (let i = 0; i < 3; i++) {
      mockPresign.mockResolvedValueOnce({ url: 'https://r2.example.com/presigned', key: `photos/${i}.webp` });
      await createPresignToken(user.id, `photos/${i}.webp`);
      const res = await request(app)
        .post('/photos')
        .set(headers)
        .send({
          album_ids: [album1.id],
          r2_key: `photos/${i}.webp`,
          taken_at: new Date().toISOString(),
          source: 'capture',
        });
      expect(res.status).toBe(201);
    }
  });
});

describe('GET /photos/:id/full', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser({ apple_sub: 'full-user' });
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/t.webp', width: 800, height: 600 });
    mockSendPush.mockResolvedValue(undefined);
    await createPresignToken(user.id, 'photos/img.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/img.webp', taken_at: '2024-06-01T10:00:00Z' });
    photoId = res.body.id;
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('fake-image-bytes'));
  });

  it('returns 200 and streams the r2 object for a member', async () => {
    const res = await request(app).get(`/photos/${photoId}/full`).set(headers);
    expect(res.status).toBe(200);
    expect(mockGetObjectBuffer).toHaveBeenCalledWith('photos/img.webp');
  });

  it('returns 403 when user is not a member of any album containing the photo', async () => {
    const other = await createTestUser({ apple_sub: 'full-other' });
    const res = await request(app).get(`/photos/${photoId}/full`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a photo id that does not exist', async () => {
    const res = await request(app)
      .get('/photos/00000000-0000-0000-0000-000000000099/full')
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get(`/photos/${photoId}/full`);
    expect(res.status).toBe(401);
  });
});

describe('GET /photos/:id/thumb', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;
  let photoId: string;

  beforeEach(async () => {
    user = await createTestUser({ apple_sub: 'thumb-user' });
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockGenThumb.mockResolvedValue({ key: 'thumbnails/t.webp', width: 800, height: 600 });
    mockSendPush.mockResolvedValue(undefined);
    await createPresignToken(user.id, 'photos/img.webp');
    const res = await request(app)
      .post('/photos')
      .set(headers)
      .send({ album_ids: [album.id], r2_key: 'photos/img.webp', taken_at: '2024-06-01T10:00:00Z' });
    photoId = res.body.id;
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('fake-thumb-bytes'));
  });

  it('returns 200 and streams the thumbnail r2 object for a member', async () => {
    const res = await request(app).get(`/photos/${photoId}/thumb`).set(headers);
    expect(res.status).toBe(200);
    expect(mockGetObjectBuffer).toHaveBeenCalledWith('thumbnails/t.webp');
  });

  it('returns 403 when user is not a member', async () => {
    const other = await createTestUser({ apple_sub: 'thumb-other' });
    const res = await request(app).get(`/photos/${photoId}/thumb`).set(authHeader(other));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a photo id that does not exist', async () => {
    const res = await request(app)
      .get('/photos/00000000-0000-0000-0000-000000000099/thumb')
      .set(headers);
    expect(res.status).toBe(404);
  });

  it('returns 401 when no auth token is provided', async () => {
    const res = await request(app).get(`/photos/${photoId}/thumb`);
    expect(res.status).toBe(401);
  });
});

describe('DELETE /photos/:id', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    mockDeleteObject.mockClear();
    mockDeleteObject.mockResolvedValue(undefined);
  });

  it('returns 204 and deletes R2 objects', async () => {
    const photo = await insertPhoto(user.id, album.id, {
      thumbnailKey: 'thumbnails/thumb.webp',
    });

    const res = await request(app).delete(`/photos/${photo.id}`).set(headers);

    expect(res.status).toBe(204);
    expect(mockDeleteObject).toHaveBeenCalledWith(photo.r2Key);
    expect(mockDeleteObject).toHaveBeenCalledWith('thumbnails/thumb.webp');
  });

  it('returns 403 when user is not the uploader', async () => {
    const other = await createTestUser({ apple_sub: 'other-delete' });
    await createTestAlbumMember(album.id, other.id);
    const photo = await insertPhoto(user.id, album.id);

    const res = await request(app)
      .delete(`/photos/${photo.id}`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
    expect(mockDeleteObject).not.toHaveBeenCalled();
  });

  it('returns 404 when photo does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const res = await request(app).delete(`/photos/${fakeId}`).set(headers);
    expect(res.status).toBe(404);
  });

  it('clears albums.cover_photo_id when deleted photo is the album cover', async () => {
    const photo = await insertPhoto(user.id, album.id);
    await db
      .update(albums)
      .set({ coverPhotoId: photo.id })
      .where(eq(albums.id, album.id));

    const res = await request(app).delete(`/photos/${photo.id}`).set(headers);
    expect(res.status).toBe(204);

    const [updated] = await db
      .select({ coverPhotoId: albums.coverPhotoId })
      .from(albums)
      .where(eq(albums.id, album.id));
    expect(updated.coverPhotoId).toBeNull();
  });
});
