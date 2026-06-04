import request from 'supertest';
import { db } from '../db';
import { dayLabels } from '../db/schema';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';

const app = require('../app');

describe('Day labels — GET range', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('returns labels in a date range', async () => {
    await db.insert(dayLabels).values([
      { albumId: album.id, date: '2026-06-01', label: '1 tháng tuổi', updatedBy: user.id },
      { albumId: album.id, date: '2026-06-15', label: 'Sinh nhật', updatedBy: user.id },
      { albumId: album.id, date: '2026-07-01', label: 'Out of range', updatedBy: user.id },
    ]);

    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((l: any) => l.date)).toEqual(['2026-06-01', '2026-06-15']);
    expect(res.body[0].label).toBe('1 tháng tuổi');
  });

  it('returns 400 when from > to', async () => {
    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-12-01&to=2026-01-01`)
      .set(headers);
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-01&to=2026-06-30`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});

describe('Day labels — PUT', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('upserts a label', async () => {
    const date = '2026-06-04';
    const res1 = await request(app)
      .put(`/albums/${album.id}/day-labels/${date}`)
      .set(headers)
      .send({ label: 'Sinh nhật' });
    expect(res1.status).toBe(200);
    expect(res1.body.label).toBe('Sinh nhật');

    const res2 = await request(app)
      .put(`/albums/${album.id}/day-labels/${date}`)
      .set(headers)
      .send({ label: '1 tuổi' });
    expect(res2.status).toBe(200);
    expect(res2.body.label).toBe('1 tuổi');
  });

  it('rejects empty label with 400', async () => {
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(headers)
      .send({ label: '   ' });
    expect(res.status).toBe(400);
  });

  it('rejects bad date format with 400', async () => {
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/06-04-2026`)
      .set(headers)
      .send({ label: 'X' });
    expect(res.status).toBe(400);
  });

  it('rejects label longer than 60 chars with 400', async () => {
    const longLabel = 'x'.repeat(61);
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(headers)
      .send({ label: longLabel });
    expect(res.status).toBe(400);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .put(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(authHeader(other))
      .send({ label: 'X' });
    expect(res.status).toBe(403);
  });
});

describe('Day labels — DELETE', () => {
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let album: Awaited<ReturnType<typeof createTestAlbum>>;
  let headers: ReturnType<typeof authHeader>;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
  });

  it('removes the label', async () => {
    const date = '2026-06-04';
    await request(app).put(`/albums/${album.id}/day-labels/${date}`).set(headers).send({ label: 'X' });

    const del = await request(app).delete(`/albums/${album.id}/day-labels/${date}`).set(headers);
    expect(del.status).toBe(204);

    const get = await request(app)
      .get(`/albums/${album.id}/day-labels?from=2026-06-04&to=2026-06-04`)
      .set(headers);
    expect(get.body).toHaveLength(0);
  });

  it('204 on idempotent delete', async () => {
    const res = await request(app)
      .delete(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(headers);
    expect(res.status).toBe(204);
  });

  it('returns 403 for non-members', async () => {
    const other = await createTestUser();
    const res = await request(app)
      .delete(`/albums/${album.id}/day-labels/2026-06-04`)
      .set(authHeader(other));
    expect(res.status).toBe(403);
  });
});
