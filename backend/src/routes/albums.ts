import express, { Request, Response, NextFunction } from 'express';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { albums, albumMembers, photos } from '../db/schema';

const router = express.Router();

router.use(requireAuth);

// Shape of an album row returned by these endpoints. Keys match the snake_case
// columns the original raw-SQL routes returned, since tests assert on them.
const albumSelect = {
  id: albums.id,
  name: albums.name,
  child_birthdate: albums.childBirthdate,
  cover_photo_id: albums.coverPhotoId,
  created_by: albums.createdBy,
  created_at: albums.createdAt,
};

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, child_birthdate } = req.body ?? {};
    if (!name) {
      res.status(400).json({ error: 'name required' });
      return;
    }

    const album = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(albums)
        .values({
          name,
          childBirthdate: child_birthdate || null,
          createdBy: req.user!.id,
        })
        .returning(albumSelect);

      await tx.insert(albumMembers).values({
        albumId: created.id,
        userId: req.user!.id,
        role: 'admin',
      });

      return created;
    });

    res.status(201).json(album);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await db
      .select(albumSelect)
      .from(albums)
      .innerJoin(albumMembers, eq(albumMembers.albumId, albums.id))
      .where(eq(albumMembers.userId, req.user!.id))
      .orderBy(desc(albums.createdAt));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const membership = await db
      .select()
      .from(albumMembers)
      .where(
        and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id))
      )
      .limit(1);

    if (!membership[0]) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const rows = await db
      .select({
        ...albumSelect,
        member_count: sql<number>`count(${albumMembers.id})::int`,
      })
      .from(albums)
      .innerJoin(albumMembers, eq(albumMembers.albumId, albums.id))
      .where(eq(albums.id, albumId))
      .groupBy(albums.id);

    if (!rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const albumId = req.params.id as string;
    const membership = await db
      .select()
      .from(albumMembers)
      .where(
        and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, req.user!.id))
      )
      .limit(1);

    if (!membership[0] || membership[0].role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { name, child_birthdate, cover_photo_id } = req.body ?? {};

    if (cover_photo_id) {
      const matchingPhotos = await db
        .select({ id: photos.id })
        .from(photos)
        .where(and(eq(photos.id, cover_photo_id), eq(photos.albumId, albumId)))
        .limit(1);

      if (!matchingPhotos[0]) {
        res.status(400).json({ error: 'cover_photo_id does not belong to this album' });
        return;
      }
    }

    // Mirror the original SQL's COALESCE semantics: only overwrite when a
    // truthy value is supplied. This matches `COALESCE($n, col)` with the JS
    // `value || null` argument coercion the old route used.
    const patch: {
      name?: string;
      childBirthdate?: string;
      coverPhotoId?: string;
    } = {};
    if (name) patch.name = name;
    if (child_birthdate) patch.childBirthdate = child_birthdate;
    if (cover_photo_id) patch.coverPhotoId = cover_photo_id;

    let updated;
    if (Object.keys(patch).length === 0) {
      // No-op update: original SQL still executed UPDATE and RETURNING because
      // COALESCE(null, col) === col. Replicate by returning the current row.
      const rows = await db
        .select(albumSelect)
        .from(albums)
        .where(eq(albums.id, albumId))
        .limit(1);
      updated = rows[0];
    } else {
      const rows = await db
        .update(albums)
        .set(patch)
        .where(eq(albums.id, albumId))
        .returning(albumSelect);
      updated = rows[0];
    }

    if (!updated) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export = router;
