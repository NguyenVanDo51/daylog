import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import * as Sentry from '@sentry/node';
import { getObjectBuffer } from './r2';
import { renderOverlayPng } from './exportOverlay';

const execFileAsync = promisify(execFile);
const DOWNLOAD_CONCURRENCY = 4;
const OVERLAY_CONCURRENCY = 4;
const PHOTO_DURATION_SECONDS = 2;
const FFMPEG_TIMEOUT_MS = 180_000;

export interface StoryExportItem {
  r2Key: string;
  mediaType: 'photo' | 'video';
  takenAt: Date;
  caption: string | null;
}

export interface RunStoryExportOpts {
  items: StoryExportItem[];
  soundtrackFilePath: string | null;
  tempDir: string;
}

/**
 * Orchestrates the story export pipeline
 * Steps:
 * 1. Download media items
 * 2. Render all overlays
 * 3. Run ffmpeg concat
 * 4. Return the output path
 * @param opts Options
 * @param signal Abort signal
 * @returns Path to the exported video file
 */
export async function runStoryExport(
  opts: RunStoryExportOpts,
  signal: AbortSignal,
): Promise<{ outputPath: string }> {
  const { items, soundtrackFilePath, tempDir } = opts;
  const startedAt = Date.now();

  Sentry.addBreadcrumb({
    category: 'export',
    message: 'export.start',
    level: 'info',
    data: { itemCount: items.length, hasSoundtrack: Boolean(soundtrackFilePath) },
  });

  const mediaDir = path.join(tempDir, 'raw');
  const overlayDir = path.join(tempDir, 'ov');
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(overlayDir, { recursive: true });

  let stage: 'download' | 'overlay' | 'ffmpeg' = 'download';
  try {
    const dlStart = Date.now();
    const mediaPaths = await downloadMediaItems(items, mediaDir);
    const downloadMs = Date.now() - dlStart;

    stage = 'overlay';
    const ovStart = Date.now();
    const overlayPaths = await renderAllOverlays(items, overlayDir);
    const overlayMs = Date.now() - ovStart;

    stage = 'ffmpeg';
    const ffStart = Date.now();
    const outputPath = path.join(tempDir, 'output.mp4');
    await runFfmpegConcat({
      items,
      mediaPaths,
      overlayPaths,
      soundtrackFilePath,
      outputPath,
      signal,
    });
    const ffmpegMs = Date.now() - ffStart;

    const mp4Bytes = fs.statSync(outputPath).size;
    Sentry.addBreadcrumb({
      category: 'export',
      message: 'export.complete',
      level: 'info',
      data: {
        durationMs: Date.now() - startedAt,
        downloadMs,
        overlayMs,
        ffmpegMs,
        mp4Bytes,
        itemCount: items.length,
      },
    });
    return { outputPath };
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'export',
      message: signal.aborted ? 'export.abort' : 'export.fail',
      level: signal.aborted ? 'warning' : 'error',
      data: {
        stage,
        reason: signal.aborted ? String(signal.reason) : undefined,
        durationMs: Date.now() - startedAt,
      },
    });
    throw err;
  }
}

/**
 * Runs a function in parallel for each item in the list
 * @param items Items to process
 * @param concurrency Maximum concurrency
 * @param fn Function to run for each item
 * @returns Results of the function calls
 */
async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      result[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);
  return result;
}

/**
 * Downloads media items to the target directory
 * @param items Items to download
 * @param targetDir Target directory
 * @returns Paths to the downloaded files
 */
async function downloadMediaItems(
  items: StoryExportItem[],
  targetDir: string,
): Promise<string[]> {
  return parallelMap(items, DOWNLOAD_CONCURRENCY, async (item, i) => {
    const ext = item.r2Key.split('.').pop() ?? (item.mediaType === 'video' ? 'mp4' : 'webp');
    const filePath = path.join(targetDir, `${pad3(i)}.${ext}`);
    const buf = await getObjectBuffer(item.r2Key);
    await fs.promises.writeFile(filePath, buf);
    return filePath;
  });
}

/**
 * Renders all overlays to the target directory
 * @param items Items to render
 * @param targetDir Target directory
 * @returns Paths to the rendered files
 */
async function renderAllOverlays(
  items: StoryExportItem[],
  targetDir: string,
): Promise<string[]> {
  return parallelMap(items, OVERLAY_CONCURRENCY, async (item, i) => {
    const filePath = path.join(targetDir, `${pad3(i)}.png`);
    const buf = await renderOverlayPng({ takenAt: item.takenAt, caption: item.caption });
    await fs.promises.writeFile(filePath, buf);
    return filePath;
  });
}

interface FfmpegConcatOpts {
  items: StoryExportItem[];
  mediaPaths: string[];
  overlayPaths: string[];
  soundtrackFilePath: string | null;
  outputPath: string;
  signal: AbortSignal;
}

/**
 * Runs ffmpeg concat to concatenate the media items and overlays
 * @param opts Options
 * @param signal Abort signal
 * @returns Path to the exported video file
 */
async function runFfmpegConcat(opts: FfmpegConcatOpts): Promise<void> {
  const { items, mediaPaths, overlayPaths, soundtrackFilePath, outputPath, signal } = opts;
  const n = items.length;

  const args: string[] = [];

  // Media inputs (0..n-1)
  for (let i = 0; i < n; i++) {
    if (items[i].mediaType === 'video') {
      args.push('-i', mediaPaths[i]);
    } else {
      args.push('-loop', '1', '-t', String(PHOTO_DURATION_SECONDS), '-i', mediaPaths[i]);
    }
  }

  // Overlay inputs (n..2n-1)
  for (let i = 0; i < n; i++) {
    args.push('-i', overlayPaths[i]);
  }

  // Audio input (2n) if provided
  if (soundtrackFilePath) {
    args.push('-stream_loop', '-1', '-i', soundtrackFilePath);
  }

  const filterParts: string[] = [];
  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
      `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[base${i}]`,
    );
    filterParts.push(`[base${i}][${n + i}:v]overlay=0:0[v${i}]`);
  }
  const concatInputs = mediaPaths.map((_, i) => `[v${i}]`).join('');
  filterParts.push(`${concatInputs}concat=n=${n}:v=1:a=0[out]`);

  if (soundtrackFilePath) {
    filterParts.push(`[${2 * n}:a]volume=0.7[a]`);
  }
  const filterComplex = filterParts.join('; ');

  const audioArgs = soundtrackFilePath
    ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k', '-shortest']
    : ['-an'];

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[out]',
    ...audioArgs,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-r', '30',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-y', outputPath,
  );

  await execFileAsync(ffmpegPath!, args, {
    signal,
    timeout: FFMPEG_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function pad3(n: number): string {
  return n.toString().padStart(3, '0');
}
