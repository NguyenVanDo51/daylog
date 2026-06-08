jest.mock('../services/r2', () => ({
  getObjectBuffer: jest.fn(),
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

import request from 'supertest';
import fs from 'fs';
import { execFile } from 'child_process';
import { getObjectBuffer } from '../services/r2';
import { db } from '../db';
import { photos, albumPhotos } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

const app = require('../app');

const mockExecFile = execFile as unknown as jest.Mock;
const mockGetObjectBuffer = getObjectBuffer as unknown as jest.Mock;

// Minimal valid WebP bytes (1x1 pixel)
const TINY_WEBP = Buffer.from(
  '52494646' + '24000000' + '57454250' + '56503820' + '18000000' +
  '30010000' + '9d012a01' + '00010000' + '34003457' + 'cc0000fe' +
  'f86300fe' + 'f8000000',
  'hex'
);

async function createTestPhoto(
  albumId: string,
  uploadedBy: string,
  mediaType: 'photo' | 'video' = 'photo'
) {
  const [photo] = await db
    .insert(photos)
    .values({
      albumId,
      uploadedBy,
      r2Key: `photos/test-${mediaType}.webp`,
      takenAt: new Date('2026-01-01T10:00:00Z'),
      mediaType,
      source: 'upload',
    })
    .returning();
  await db.insert(albumPhotos).values({ photoId: photo.id, albumId });
  return photo;
}

describe('GET /stories/export', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);

    mockGetObjectBuffer.mockResolvedValue(TINY_WEBP);

    // Write a fake MP4 at the output path (last arg) and call callback with no error
    mockExecFile.mockImplementation((_bin: string, args: string[], cb: Function) => {
      const outputPath = args[args.length - 1];
      fs.writeFileSync(outputPath, Buffer.from('fake-mp4-bytes'));
      cb(null);
    });
  });

  it('returns 401 with no auth', async () => {
    const res = await request(app).get('/stories/export?photo_ids=irrelevant');
    expect(res.status).toBe(401);
  });

  it('returns 400 when photo_ids is missing', async () => {
    const res = await request(app).get('/stories/export').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo_ids/);
  });

  it('returns 400 when photo_ids is empty', async () => {
    const res = await request(app).get('/stories/export?photo_ids=').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/photo_ids/);
  });

  it('returns 400 when more than 30 photo_ids supplied', async () => {
    const ids = Array.from({ length: 31 }, () =>
      '00000000-0000-0000-0000-000000000000'
    ).join(',');
    const res = await request(app)
      .get(`/stories/export?photo_ids=${ids}`)
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/30/);
  });

  it('returns 400 when a photo_id is not a valid UUID', async () => {
    const res = await request(app)
      .get('/stories/export?photo_ids=not-a-uuid')
      .set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/UUID/);
  });

  it('returns 403 when the user cannot access a photo', async () => {
    const other = await createTestUser({ apple_sub: 'other-sub' });
    const otherAlbum = await createTestAlbum(other.id);
    const photo = await createTestPhoto(otherAlbum.id, other.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}`)
      .set(headers);
    expect(res.status).toBe(403);
  });

  it('returns 200 video/mp4 for a single photo the user owns', async () => {
    const photo = await createTestPhoto(album.id, user.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/video\/mp4/);
    expect(res.body).toBeTruthy();
  });

  it('returns 200 video/mp4 for a mix of photo and video types', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const video = await createTestPhoto(album.id, user.id, 'video');

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id},${video.id}`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/video\/mp4/);
  });

  it('returns 403 when user has access to some but not all photos', async () => {
    const photo = await createTestPhoto(album.id, user.id);
    const other = await createTestUser({ apple_sub: 'other2' });
    const otherAlbum = await createTestAlbum(other.id);
    const otherPhoto = await createTestPhoto(otherAlbum.id, other.id);

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id},${otherPhoto.id}`)
      .set(headers);

    expect(res.status).toBe(403);
  });
});
