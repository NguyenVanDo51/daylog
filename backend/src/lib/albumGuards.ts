import { eq } from 'drizzle-orm';
import { db } from '../db';
import { albums } from '../db/schema';

export async function isAlbumArchived(albumId: string): Promise<boolean> {
  const rows = await db
    .select({ archivedAt: albums.archivedAt })
    .from(albums)
    .where(eq(albums.id, albumId))
    .limit(1);
  return rows.length > 0 && rows[0].archivedAt !== null;
}
