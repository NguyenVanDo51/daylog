import express, { Request, Response, NextFunction } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import ffmpegPath from 'ffmpeg-static';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { photos, albumPhotos, albumMembers, soundtracks } from '../db/schema';
import { getObjectBuffer } from '../services/r2';
import { isValidUUID } from '../lib/validation';

const router = express.Router();
const execFileAsync = promisify(execFile);

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
    // Fetch photos with their media type and r2 key
    const rows = await db
      .select({
        id: photos.id,
        r2Key: photos.r2Key,
        mediaType: photos.mediaType,
      })
      .from(photos)
      .where(inArray(photos.id, ids));

    if (rows.length !== ids.length) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Verify user has album membership for each photo
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

    // Preserve caller-specified order
    const rowById = new Map(rows.map((r) => [r.id, r]));
    const ordered = ids.map((id) => rowById.get(id)!);

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

    const tempDir = path.join(os.tmpdir(), `story-export-${randomUUID()}`);
    fs.mkdirSync(tempDir);
    const outputPath = path.join(tempDir, 'output.mp4');

    try {
      const localPaths: { filePath: string; mediaType: string }[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const { r2Key, mediaType } = ordered[i];
        const ext = r2Key.split('.').pop() ?? 'webp';
        const filePath = path.join(tempDir, `${i.toString().padStart(3, '0')}.${ext}`);
        const buf = await getObjectBuffer(r2Key);
        fs.writeFileSync(filePath, buf);
        localPaths.push({ filePath, mediaType });
      }

      const ffArgs: string[] = [];
      for (const { filePath, mediaType } of localPaths) {
        if (mediaType === 'video') {
          ffArgs.push('-i', filePath);
        } else {
          ffArgs.push('-loop', '1', '-t', '3', '-i', filePath);
        }
      }
      if (soundtrackFilePath) {
        ffArgs.push('-stream_loop', '-1', '-i', soundtrackFilePath);
      }

      const videoCount = localPaths.length;
      const filterParts = localPaths.map((_, i) =>
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
        `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
      );
      const concatInputs = localPaths.map((_, i) => `[v${i}]`).join('');
      const filterArr: string[] = [
        ...filterParts,
        `${concatInputs}concat=n=${videoCount}:v=1:a=0[out]`,
      ];
      if (soundtrackFilePath) {
        filterArr.push(`[${videoCount}:a]volume=0.7[a]`);
      }
      const filterComplex = filterArr.join('; ');

      const audioArgs = soundtrackFilePath
        ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k', '-shortest']
        : ['-an'];

      await execFileAsync(ffmpegPath!, [
        ...ffArgs,
        '-filter_complex', filterComplex,
        '-map', '[out]',
        ...audioArgs,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-r', '30',
        '-y', outputPath,
      ]);

      const mp4 = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', mp4.length);
      res.send(mp4);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (err) {
    next(err);
  }
});

export = router;
