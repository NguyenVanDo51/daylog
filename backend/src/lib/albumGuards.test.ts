import { randomUUID } from 'crypto';
import { db } from '../db';
import { albums } from '../db/schema';
import { eq } from 'drizzle-orm';
import { isAlbumArchived } from './albumGuards';
import { createTestUser, createTestAlbum } from '../../tests/setup';

describe('isAlbumArchived', () => {
  it('returns false for an active album', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    expect(await isAlbumArchived(album.id)).toBe(false);
  });

  it('returns true once archivedAt is set', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    await db.update(albums).set({ archivedAt: new Date() }).where(eq(albums.id, album.id));
    expect(await isAlbumArchived(album.id)).toBe(true);
  });

  it('returns false for a non-existent album id', async () => {
    expect(await isAlbumArchived(randomUUID())).toBe(false);
  });
});
