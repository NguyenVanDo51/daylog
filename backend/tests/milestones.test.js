const request = require('supertest');
const app = require('../src/app');
const { createTestUser, createTestAlbum, authHeader } = require('./setup');

jest.mock('../src/services/apns');
const { sendPush } = require('../src/services/apns');

describe('Milestones', () => {
  let user, album, headers;

  beforeEach(async () => {
    user = await createTestUser();
    album = await createTestAlbum(user.id);
    headers = authHeader(user);
    sendPush.mockResolvedValue();
  });

  it('POST /albums/:id/milestones creates a milestone', async () => {
    const res = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First steps', note: 'She walked!', occurred_at: '2024-09-15T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('First steps');
    expect(res.body.note).toBe('She walked!');
  });

  it('GET /albums/:id/milestones returns all milestones sorted by occurred_at desc', async () => {
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });
    await request(app).post(`/albums/${album.id}/milestones`).set(headers)
      .send({ title: 'First steps', occurred_at: '2024-09-01T00:00:00Z' });

    const res = await request(app).get(`/albums/${album.id}/milestones`).set(headers);

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('First steps');
    expect(res.body[1].title).toBe('First smile');
  });

  it('PATCH /milestones/:id updates a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app)
      .patch(`/milestones/${created.body.id}`)
      .set(headers)
      .send({ note: 'So cute!' });

    expect(res.status).toBe(200);
    expect(res.body.note).toBe('So cute!');
  });

  it('DELETE /milestones/:id deletes a milestone', async () => {
    const created = await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    const res = await request(app).delete(`/milestones/${created.body.id}`).set(headers);
    expect(res.status).toBe(204);
  });

  it('sends push notification when milestone is created', async () => {
    await request(app)
      .post(`/albums/${album.id}/milestones`)
      .set(headers)
      .send({ title: 'First smile', occurred_at: '2024-03-01T00:00:00Z' });

    expect(sendPush).toHaveBeenCalled();
  });
});
