jest.mock('../services/r2', () => ({
  getObjectBuffer: jest.fn(),
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('../services/exportOverlay', () => ({
  renderOverlayPng: jest.fn(),
}));

jest.mock('@sentry/node', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  setupExpressErrorHandler: jest.fn((app: any) => app),
  setUser: jest.fn(),
  init: jest.fn(),
}));

import request from 'supertest';
import fs from 'fs';
import { execFile } from 'child_process';
import { getObjectBuffer } from '../services/r2';
import { renderOverlayPng } from '../services/exportOverlay';
import { _resetQueueForTests } from '../services/exportQueue';
import { db } from '../db';
import { photos, albumPhotos, soundtracks } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

const app = require('../app');

const mockExecFile = execFile as unknown as jest.Mock;
const mockGetObjectBuffer = getObjectBuffer as unknown as jest.Mock;
const mockRenderOverlayPng = renderOverlayPng as unknown as jest.Mock;

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
    mockExecFile.mockClear();
    mockRenderOverlayPng.mockReset();
    mockRenderOverlayPng.mockResolvedValue(Buffer.from('fake-overlay-png'));
    _resetQueueForTests();

    // execFile is invoked via promisify(execFile) with options containing
    // {signal, killSignal}, so the callback is the 4th positional arg.
    // We also support the 3-arg signature to keep existing tests working.
    mockExecFile.mockImplementation((..._args: any[]) => {
      const args = _args[1] as string[];
      const cb = (typeof _args[2] === 'function' ? _args[2] : _args[3]) as Function;
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

  it('passes soundtrack input + audio map to ffmpeg when soundtrack_id provided', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const [track] = await db.insert(soundtracks).values({
      key: 'lullaby_01', title: 'Mây trắng', durationMs: 30000, filePath: 'lullaby_01.mp3', isActive: true,
    }).returning();
    // Ensure the placeholder file exists (Task 4 should have committed it)
    const fs2 = require('fs');
    const path2 = require('path');
    const fixturePath = path2.join(__dirname, '../../assets/soundtracks/lullaby_01.mp3');
    if (!fs2.existsSync(fixturePath)) {
      throw new Error('lullaby_01.mp3 fixture missing — Task 4 must run first');
    }

    mockExecFile.mockImplementation((..._args: any[]) => {
      const args = _args[1] as string[];
      const cb = (typeof _args[2] === 'function' ? _args[2] : _args[3]) as Function;
      fs.writeFileSync(args[args.length - 1], 'fake mp4 data');
      cb(null, { stdout: '', stderr: '' });
    });

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=${track.id}`)
      .set(headers);
    expect(res.status).toBe(200);

    const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
    expect(ffmpegArgs).toContain('-stream_loop');
    expect(ffmpegArgs.some((a) => a.endsWith('lullaby_01.mp3'))).toBe(true);
    expect(ffmpegArgs).toContain('-shortest');
    expect(ffmpegArgs).toContain('-c:a');
    expect(ffmpegArgs).toContain('aac');
    expect(ffmpegArgs).not.toContain('-an');
  });

  it('silent fallback when soundtrack_id is non-existent UUID', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    mockExecFile.mockImplementation((..._args: any[]) => {
      const args = _args[1] as string[];
      const cb = (typeof _args[2] === 'function' ? _args[2] : _args[3]) as Function;
      fs.writeFileSync(args[args.length - 1], 'fake mp4');
      cb(null, { stdout: '', stderr: '' });
    });

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=00000000-0000-0000-0000-000000000000`)
      .set(headers);
    expect(res.status).toBe(200);
    const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
    expect(ffmpegArgs).toContain('-an');
  });

  it('silent fallback when soundtrack is inactive', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const [track] = await db.insert(soundtracks).values({
      key: 'old', title: 'Old', durationMs: 10000, filePath: 'lullaby_01.mp3', isActive: false,
    }).returning();
    mockExecFile.mockImplementation((..._args: any[]) => {
      const args = _args[1] as string[];
      const cb = (typeof _args[2] === 'function' ? _args[2] : _args[3]) as Function;
      fs.writeFileSync(args[args.length - 1], 'fake mp4');
      cb(null, { stdout: '', stderr: '' });
    });

    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=${track.id}`)
      .set(headers);
    expect(res.status).toBe(200);
    const ffmpegArgs = mockExecFile.mock.calls[0][1] as string[];
    expect(ffmpegArgs).toContain('-an');
  });

  it('rejects invalid soundtrack_id format with 400', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const res = await request(app)
      .get(`/stories/export?photo_ids=${photo.id}&soundtrack_id=not-a-uuid`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('uses 2-second photo duration in the ffmpeg arguments', async () => {
    const photo = await createTestPhoto(album.id, user.id, 'photo');

    await request(app)
      .get(`/stories/export?photo_ids=${photo.id}`)
      .set(headers);

    expect(mockExecFile).toHaveBeenCalled();
    const args = mockExecFile.mock.calls[0][1] as string[];
    // Photo inputs are added as: -loop 1 -t 2 -i <path>
    const tIdx = args.indexOf('-t');
    expect(tIdx).toBeGreaterThan(-1);
    expect(args[tIdx + 1]).toBe('2');
  });

  it('renders an overlay PNG per item and feeds it to ffmpeg', async () => {
    const a = await createTestPhoto(album.id, user.id, 'photo');
    const b = await createTestPhoto(album.id, user.id, 'video');

    await request(app)
      .get(`/stories/export?photo_ids=${a.id},${b.id}`)
      .set(headers);

    expect(mockRenderOverlayPng).toHaveBeenCalledTimes(2);
  });

  it('returns 429 when the queue is already full', async () => {
    // Pre-saturate the queue with 4 never-resolving jobs.
    mockExecFile.mockImplementationOnce(() => undefined);   // no callback → never resolves
    mockExecFile.mockImplementationOnce(() => undefined);
    mockExecFile.mockImplementationOnce(() => undefined);
    mockExecFile.mockImplementationOnce(() => undefined);

    const photo = await createTestPhoto(album.id, user.id, 'photo');
    const url = `/stories/export?photo_ids=${photo.id}`;

    // Fire and forget the first four (they will hang inside ffmpeg promise).
    const pending = [
      request(app).get(url).set(headers).end(() => {}),
      request(app).get(url).set(headers).end(() => {}),
      request(app).get(url).set(headers).end(() => {}),
      request(app).get(url).set(headers).end(() => {}),
    ];
    // Give the 4 requests time to complete auth+DB work and enter withExportSlot.
    await new Promise((r) => setTimeout(r, 500));

    const res = await request(app).get(url).set(headers);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('30');

    // Abort the dangling requests so jest can shut down.
    pending.forEach((p) => p.abort?.());
  }, 30_000);
});
