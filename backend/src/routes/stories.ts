import express, { Request, Response, NextFunction } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { photos, albumPhotos, albumMembers, soundtracks } from '../db/schema';
import { isValidUUID } from '../lib/validation';
import { withExportSlot, QueueFullError } from '../services/exportQueue';
import { runStoryExport, StoryExportItem } from '../services/exportPipeline';

const router = express.Router();

router.use(requireAuth);

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  const raw = req.query.photo_ids as string | undefined;

  if (!raw) {
    return res.status(400).json({ error: 'photo_ids query param is required' });
  }

  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) {
    return res.status(400).json({ error: 'photo_ids must not be empty' });
  }
  if (ids.length > 30) {
    return res.status(400).json({ error: 'photo_ids must contain at most 30 entries' });
  }
  if (!ids.every(isValidUUID)) {
    return res.status(400).json({ error: 'Every photo_id must be a valid UUID' });
  }

  const soundtrackId = req.query.soundtrack_id as string | undefined;
  if (soundtrackId !== undefined && !isValidUUID(soundtrackId)) {
    return res.status(400).json({ error: 'soundtrack_id must be a valid UUID' });
  }

  try {
    const rows = await db
      .select({
        id: photos.id,
        r2Key: photos.r2Key,
        mediaType: photos.mediaType,
        takenAt: photos.takenAt,
        caption: photos.caption,
      })
      .from(photos)
      .where(inArray(photos.id, ids));

    if (rows.length !== ids.length) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const accessChecks = await db
      .select({ photoId: albumPhotos.photoId })
      .from(albumPhotos)
      .innerJoin(
        albumMembers,
        and(
          eq(albumMembers.albumId, albumPhotos.albumId),
          eq(albumMembers.userId, req.user!.id),
        ),
      )
      .where(inArray(albumPhotos.photoId, ids));

    const accessibleIds = new Set(accessChecks.map((r) => r.photoId));
    if (!ids.every((id) => accessibleIds.has(id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rowById = new Map(rows.map((r) => [r.id, r]));
    const items: StoryExportItem[] = ids.map((id) => {
      const r = rowById.get(id)!;
      return {
        r2Key: r.r2Key,
        mediaType: r.mediaType as 'photo' | 'video',
        takenAt: new Date(r.takenAt as unknown as string),
        caption: (r.caption as string | null) ?? null,
      };
    });

    let soundtrackFilePath: string | null = null;
    if (soundtrackId) {
      const [track] = await db.select().from(soundtracks)
        .where(and(eq(soundtracks.id, soundtrackId), eq(soundtracks.isActive, true)))
        .limit(1);
      if (track) {
        const candidatePath = path.join(__dirname, '../../assets/soundtracks', track.filePath);
        if (fs.existsSync(candidatePath)) soundtrackFilePath = candidatePath;
      }
    }

    const ac = new AbortController();
    req.on('close', () => {
      if (!res.writableEnded) ac.abort('client-closed');
    });
    const timeoutTimer = setTimeout(() => ac.abort('timeout'), 180_000);

    const tempDir = path.join(os.tmpdir(), `story-export-${randomUUID()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      const { outputPath } = await withExportSlot(() =>
        runStoryExport({ items, soundtrackFilePath, tempDir }, ac.signal),
      );

      if (ac.signal.aborted) {
        clearTimeout(timeoutTimer);
        if (ac.signal.reason === 'timeout') {
          return res.status(504).json({ error: 'Export timed out' });
        }
        return; // client closed — nothing to send
      }

      const stat = await fs.promises.stat(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', String(stat.size));
      await pipeline(fs.createReadStream(outputPath), res);
    } finally {
      clearTimeout(timeoutTimer);
      try {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup; do not mask primary error
      }
    }
  } catch (err) {
    if (err instanceof QueueFullError) {
      res.setHeader('Retry-After', '30');
      return res.status(429).json({ error: 'Server busy, try again shortly' });
    }
    next(err);
  }
});

export = router;
