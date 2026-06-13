# Export Pipeline v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-06-12-export-pipeline-v2-design.md`

**Goal:** Refactor `GET /stories/export` to add per-process concurrency control (semaphore + queue-depth guard), stream the response, abort ffmpeg on disconnect/timeout, and bake a story-view-style overlay (hour stamp + static caption + bottom scrim) into each rendered frame.

**Architecture:** Three new services live next to the route — `exportQueue` (custom semaphore + 429 guard), `exportOverlay` (canvas-rendered transparent PNG per item), `exportPipeline` (orchestrates download → overlay → ffmpeg → stream). The route becomes thin glue.

**Tech Stack:** Node 20, Express, ts-jest, ffmpeg-static, @napi-rs/canvas, date-fns-tz, @aws-sdk/client-s3 (existing).

---

## File Structure

| Path | Role |
|---|---|
| `backend/src/services/exportQueue.ts` | NEW — `withExportSlot`, `QueueFullError`, internal `Semaphore` |
| `backend/src/services/exportQueue.test.ts` | NEW — unit tests for queue + 429 |
| `backend/src/services/exportOverlay.ts` | NEW — `renderOverlayPng({takenAt, caption})` |
| `backend/src/services/exportOverlay.test.ts` | NEW — unit tests for PNG dimensions + caption variants |
| `backend/src/services/exportPipeline.ts` | NEW — `runStoryExport(opts, signal)`; internal helpers `downloadMediaItems`, `renderAllOverlays`, `runFfmpegConcat` |
| `backend/src/routes/stories.ts` | MODIFY — replace inline pipeline with `withExportSlot` + `runStoryExport` + streamed response |
| `backend/src/routes/stories.test.ts` | MODIFY — extend with 429 test, photo 2s assertion, overlay mock |
| `backend/assets/fonts/Baloo2-Bold.ttf` | NEW — bundled font |
| `backend/assets/fonts/Baloo2-Medium.ttf` | NEW — bundled font |
| `backend/Dockerfile` | MODIFY — `COPY assets ./assets` in runtime stage |
| `backend/package.json` | MODIFY — add `@napi-rs/canvas`, `date-fns-tz` |

---

## Task 1: Bundle fonts + add deps

**Files:**
- Create: `backend/assets/fonts/Baloo2-Bold.ttf`
- Create: `backend/assets/fonts/Baloo2-Medium.ttf`
- Modify: `backend/package.json`

- [ ] **Step 1: Copy TTF files from the mobile font package**

```bash
cp mobile/node_modules/@expo-google-fonts/baloo-2/700Bold/Baloo2_700Bold.ttf \
   backend/assets/fonts/Baloo2-Bold.ttf
cp mobile/node_modules/@expo-google-fonts/baloo-2/500Medium/Baloo2_500Medium.ttf \
   backend/assets/fonts/Baloo2-Medium.ttf
ls backend/assets/fonts/
```

Expected: two `.ttf` files listed. They're SIL Open Font License (see `mobile/node_modules/@expo-google-fonts/baloo-2/LICENSE_FONT`), safe to bundle.

- [ ] **Step 2: Install runtime dependencies**

```bash
cd backend
npm install @napi-rs/canvas@^0.1.65 date-fns-tz@^3.2.0
```

Expected: `package.json` shows both packages in `dependencies`. `@napi-rs/canvas` ships prebuilt Linux/macOS binaries — no `node-gyp` required.

- [ ] **Step 3: Sanity-check the canvas binding loads**

```bash
cd backend
node -e "const c = require('@napi-rs/canvas'); const cv = c.createCanvas(10, 10); console.log('ok', cv.width, cv.height);"
```

Expected: `ok 10 10`. If this errors, the prebuilt binary for your arch isn't present and you need `@napi-rs/canvas-<platform>` peer install — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add backend/assets/fonts/Baloo2-Bold.ttf backend/assets/fonts/Baloo2-Medium.ttf backend/package.json backend/package-lock.json
git commit -m "build(backend): bundle Baloo 2 fonts and add canvas + date-fns-tz deps for export overlays"
```

---

## Task 2: exportQueue service (TDD)

**Files:**
- Create: `backend/src/services/exportQueue.ts`
- Create: `backend/src/services/exportQueue.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/exportQueue.test.ts`:

```typescript
import { withExportSlot, QueueFullError, _resetQueueForTests } from './exportQueue';

describe('exportQueue', () => {
  beforeEach(() => _resetQueueForTests());

  it('allows the first 2 callers to run concurrently', async () => {
    const order: string[] = [];
    const release: Array<() => void> = [];
    const block = () => new Promise<void>((r) => release.push(r));

    const p1 = withExportSlot(async () => { order.push('a-start'); await block(); order.push('a-end'); });
    const p2 = withExportSlot(async () => { order.push('b-start'); await block(); order.push('b-end'); });

    await new Promise((r) => setImmediate(r));
    expect(order).toEqual(['a-start', 'b-start']);

    release.forEach((r) => r());
    await Promise.all([p1, p2]);
  });

  it('queues a 3rd caller until a slot frees', async () => {
    const release: Array<() => void> = [];
    const block = () => new Promise<void>((r) => release.push(r));
    let thirdStarted = false;

    const p1 = withExportSlot(block);
    const p2 = withExportSlot(block);
    const p3 = withExportSlot(async () => { thirdStarted = true; });

    await new Promise((r) => setImmediate(r));
    expect(thirdStarted).toBe(false);

    release[0]();
    await p1;
    await p3;
    expect(thirdStarted).toBe(true);

    release[1]();
    await p2;
  });

  it('throws QueueFullError when a 5th caller arrives with 4 already pending', async () => {
    const release: Array<() => void> = [];
    const block = () => new Promise<void>((r) => release.push(r));

    const slots = [
      withExportSlot(block),
      withExportSlot(block),
      withExportSlot(block),
      withExportSlot(block),
    ];
    await new Promise((r) => setImmediate(r));

    await expect(withExportSlot(async () => 'x')).rejects.toBeInstanceOf(QueueFullError);

    release.forEach((r) => r());
    await Promise.all(slots);
  });

  it('decrements pending on error so subsequent callers can proceed', async () => {
    await expect(
      withExportSlot(async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');

    const ok = await withExportSlot(async () => 'ok');
    expect(ok).toBe('ok');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest src/services/exportQueue.test.ts
```

Expected: FAIL — `Cannot find module './exportQueue'`.

- [ ] **Step 3: Implement the service**

Create `backend/src/services/exportQueue.ts`:

```typescript
const SLOTS = 2;
const MAX_PENDING = 4;

class Semaphore {
  private inUse = 0;
  private waiters: Array<() => void> = [];

  constructor(private readonly capacity: number) {}

  async acquire(): Promise<void> {
    if (this.inUse < this.capacity) {
      this.inUse++;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    this.inUse++;
  }

  release(): void {
    this.inUse--;
    const next = this.waiters.shift();
    if (next) next();
  }
}

export class QueueFullError extends Error {
  constructor() {
    super('Export queue is full');
    this.name = 'QueueFullError';
  }
}

let pendingCount = 0;
let semaphore = new Semaphore(SLOTS);

export async function withExportSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (pendingCount >= MAX_PENDING) {
    throw new QueueFullError();
  }
  pendingCount++;
  try {
    await semaphore.acquire();
    try {
      return await fn();
    } finally {
      semaphore.release();
    }
  } finally {
    pendingCount--;
  }
}

// Test-only: drop any in-flight state between tests so cases stay isolated.
export function _resetQueueForTests(): void {
  pendingCount = 0;
  semaphore = new Semaphore(SLOTS);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
npx jest src/services/exportQueue.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/exportQueue.ts backend/src/services/exportQueue.test.ts
git commit -m "feat(backend): add exportQueue with N=2 slot semaphore and MAX_PENDING=4 backpressure"
```

---

## Task 3: exportOverlay service (TDD)

**Files:**
- Create: `backend/src/services/exportOverlay.ts`
- Create: `backend/src/services/exportOverlay.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/services/exportOverlay.test.ts`:

```typescript
import { renderOverlayPng } from './exportOverlay';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('exportOverlay.renderOverlayPng', () => {
  it('produces a 1080x1920 PNG with the correct signature', async () => {
    const buf = await renderOverlayPng({
      takenAt: new Date('2026-01-01T14:32:00Z'),
      caption: 'Một ngày đẹp',
    });

    expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(buf.readUInt32BE(16)).toBe(1080);
    expect(buf.readUInt32BE(20)).toBe(1920);
  });

  it('renders without error when caption is null or empty', async () => {
    const a = await renderOverlayPng({ takenAt: new Date(), caption: null });
    const b = await renderOverlayPng({ takenAt: new Date(), caption: '   ' });
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });

  it('does not throw on captions longer than two visible lines', async () => {
    const long = 'a b c d e f g h i j k l m n o p q r s t u v w x y z '.repeat(8);
    const buf = await renderOverlayPng({ takenAt: new Date(), caption: long });
    expect(buf.length).toBeGreaterThan(0);
  });

  it('formats the hour stamp in Asia/Ho_Chi_Minh as HH:mm', async () => {
    // 07:32 UTC == 14:32 ICT. We can't peek at the rendered pixels easily, but
    // we can at least ensure the call shape works for that input — visual
    // verification belongs in the manual step at the end of the plan.
    const buf = await renderOverlayPng({
      takenAt: new Date('2026-01-01T07:32:00Z'),
      caption: null,
    });
    expect(buf.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest src/services/exportOverlay.test.ts
```

Expected: FAIL — `Cannot find module './exportOverlay'`.

- [ ] **Step 3: Implement the overlay renderer**

Create `backend/src/services/exportOverlay.ts`:

```typescript
import path from 'path';
import { createCanvas, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import { formatInTimeZone } from 'date-fns-tz';

const W = 1080;
const H = 1920;
const TIME_Y = Math.round(H * 0.38);            // 730
const CAPTION_TOP = TIME_Y + 60;                  // 8px below baseline-ish
const CAPTION_LINE_HEIGHT = 60;
const CAPTION_MAX_WIDTH = Math.round(W * 0.8);    // 864
const CAPTION_MAX_LINES = 2;

let fontsRegistered = false;
function ensureFonts(): void {
  if (fontsRegistered) return;
  const fontsDir = path.join(__dirname, '../../assets/fonts');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Baloo2-Bold.ttf'), 'Baloo 2 Bold');
  GlobalFonts.registerFromPath(path.join(fontsDir, 'Baloo2-Medium.ttf'), 'Baloo 2 Medium');
  fontsRegistered = true;
}

export async function renderOverlayPng(opts: {
  takenAt: Date;
  caption: string | null;
}): Promise<Buffer> {
  ensureFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Bottom scrim — matches story-view LinearGradient(transparent → 0.55 → 0.82)
  const scrimTop = Math.round(H * 0.667);
  const grad = ctx.createLinearGradient(0, scrimTop, 0, H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  grad.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  // Shared text style — white + soft dark halo (matches OutlinedText)
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Hour stamp
  const timeStr = formatInTimeZone(opts.takenAt, 'Asia/Ho_Chi_Minh', 'HH:mm');
  ctx.font = '700 56px "Baloo 2 Bold"';
  ctx.shadowBlur = 22;
  ctx.fillText(timeStr, W / 2, TIME_Y);

  // Caption (static — no typewriter)
  const caption = (opts.caption ?? '').trim();
  if (caption.length > 0) {
    ctx.font = '500 50px "Baloo 2 Medium"';
    ctx.shadowBlur = 16;
    const lines = wrapText(ctx, caption, CAPTION_MAX_WIDTH, CAPTION_MAX_LINES);
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, CAPTION_TOP + i * CAPTION_LINE_HEIGHT);
    });
  }

  return canvas.toBuffer('image/png');
}

function wrapText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let consumed = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
      consumed = i + 1;
    } else {
      if (current) lines.push(current);
      current = word;
      consumed = i + 1;
      if (lines.length >= maxLines) {
        current = '';
        break;
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (consumed < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last}…`;
  }

  return lines;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
npx jest src/services/exportOverlay.test.ts
```

Expected: all 4 tests pass. First run may take 1–2s due to `@napi-rs/canvas` init.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/exportOverlay.ts backend/src/services/exportOverlay.test.ts
git commit -m "feat(backend): add exportOverlay rendering hour stamp + static caption + scrim onto a 1080x1920 PNG"
```

---

## Task 4: exportPipeline orchestrator + handler refactor

This task is bigger because the orchestrator and the route handler are tightly coupled — the cleanest way to land them is together with the route's existing test suite updated in one go.

**Files:**
- Create: `backend/src/services/exportPipeline.ts`
- Modify: `backend/src/routes/stories.ts` (lines 21–161 — the export handler)
- Modify: `backend/src/routes/stories.test.ts` (mocks + new tests)

- [ ] **Step 1: Sketch the orchestrator's public shape**

Create `backend/src/services/exportPipeline.ts` with the function signature only (so the route can import without TS errors during the rewrite):

```typescript
import path from 'path';

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

export async function runStoryExport(
  _opts: RunStoryExportOpts,
  _signal: AbortSignal,
): Promise<{ outputPath: string }> {
  throw new Error('not implemented');
}
```

- [ ] **Step 2: Update the existing test mocks for the new code path**

Modify `backend/src/routes/stories.test.ts`. At the top of the file, alongside the existing `jest.mock` blocks, add an overlay mock and replace the `execFile` mock signature so it tolerates the `{signal}` options arg added in this refactor.

Replace this block at the very top of the file:

```typescript
jest.mock('../services/r2', () => ({
  getObjectBuffer: jest.fn(),
}));

jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));
```

with:

```typescript
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
}));
```

Then update the `beforeEach` in `describe('GET /stories/export', ...)`. Find:

```typescript
    mockGetObjectBuffer.mockResolvedValue(TINY_WEBP);
    mockExecFile.mockClear();

    // Write a fake MP4 at the output path (last arg) and call callback with no error
    mockExecFile.mockImplementation((_bin: string, args: string[], cb: Function) => {
      const outputPath = args[args.length - 1];
      fs.writeFileSync(outputPath, Buffer.from('fake-mp4-bytes'));
      cb(null);
    });
```

Replace with:

```typescript
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
```

Add the matching imports near the existing imports in that file:

```typescript
import { renderOverlayPng } from '../services/exportOverlay';
import { _resetQueueForTests } from '../services/exportQueue';
```

And the matching mock handle near `const mockExecFile = …` line:

```typescript
const mockRenderOverlayPng = renderOverlayPng as unknown as jest.Mock;
```

- [ ] **Step 3: Add the new tests for v2 behavior**

Add these `it()` blocks at the end of the `describe('GET /stories/export', ...)` block (just before its closing `});`):

```typescript
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
    const release: Array<() => void> = [];
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
    await new Promise((r) => setImmediate(r));

    const res = await request(app).get(url).set(headers);
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBe('30');

    // Abort the dangling requests so jest can shut down.
    pending.forEach((p) => p.abort?.());
  });
```

- [ ] **Step 4: Run the test suite to verify the route tests fail in the right places**

```bash
cd backend
npx jest src/routes/stories.test.ts
```

Expected: existing tests still need new fields wired through (the new `runStoryExport` is a stub throwing). Several tests should fail with "not implemented" or "renderOverlayPng was not called" or "Retry-After header missing".

- [ ] **Step 5: Replace the route handler**

Replace the entire body of the export handler in `backend/src/routes/stories.ts` (lines 21–161) with the following. Imports at the top of the file should be adjusted to match (remove now-unused ffmpeg/exec/os/fs/randomUUID; add new imports).

New top-of-file imports (replace the existing import block lines 1–14):

```typescript
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
```

New handler (replace `router.get('/export', …)` through its closing `});`):

```typescript
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
```

- [ ] **Step 6: Implement the orchestrator**

Replace the stub body of `backend/src/services/exportPipeline.ts` with:

```typescript
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
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

export async function runStoryExport(
  opts: RunStoryExportOpts,
  signal: AbortSignal,
): Promise<{ outputPath: string }> {
  const { items, soundtrackFilePath, tempDir } = opts;

  const mediaDir = path.join(tempDir, 'raw');
  const overlayDir = path.join(tempDir, 'ov');
  fs.mkdirSync(mediaDir, { recursive: true });
  fs.mkdirSync(overlayDir, { recursive: true });

  const mediaPaths = await downloadMediaItems(items, mediaDir);
  const overlayPaths = await renderAllOverlays(items, overlayDir);

  const outputPath = path.join(tempDir, 'output.mp4');
  await runFfmpegConcat({
    items,
    mediaPaths,
    overlayPaths,
    soundtrackFilePath,
    outputPath,
    signal,
  });

  return { outputPath };
}

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
```

- [ ] **Step 6b: Instrument with Sentry breadcrumbs**

Add observability to the orchestrator so post-launch incidents can be triaged from Sentry alone. Modify `backend/src/services/exportPipeline.ts`:

Add to the imports at the top:

```typescript
import * as Sentry from '@sentry/node';
```

Refactor the `runStoryExport` body to capture timings and emit breadcrumbs. Replace the existing body of `runStoryExport` with:

```typescript
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
```

Note: the helper functions (`downloadMediaItems`, `renderAllOverlays`, `runFfmpegConcat`, `parallelMap`, `pad3`) remain unchanged from Step 6.

- [ ] **Step 7: Run the route tests to verify everything passes**

```bash
cd backend
npx jest src/routes/stories.test.ts
```

Expected: all existing tests pass plus the three new ones (`uses 2-second photo duration`, `renders an overlay PNG per item`, `returns 429 when the queue is already full`).

- [ ] **Step 8: Run the full backend test suite**

```bash
cd backend
npm test
```

Expected: green; coverage thresholds (90%/90%/90%/90%) still met. If coverage dips below threshold in a new file, add the missing unit test rather than lowering the threshold.

- [ ] **Step 9: Commit**

```bash
git add backend/src/services/exportPipeline.ts \
        backend/src/routes/stories.ts \
        backend/src/routes/stories.test.ts
git commit -m "feat(backend): refactor /stories/export to use queue + overlay pipeline with 2s photos, streamed response, abort-on-disconnect"
```

---

## Task 5: Wire fonts and soundtracks into the Docker image

`backend/assets/` is not currently copied into the runtime image. The font bundle (and incidentally the existing `assets/soundtracks` directory) must be present for the export pipeline to work in production.

**Files:**
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Add the assets COPY directive**

Modify `backend/Dockerfile`. After the line `COPY src/db/migrations ./src/db/migrations`, add:

```dockerfile
COPY assets ./assets
```

The final runtime stage should look like:

```dockerfile
FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./src/db/migrations
COPY assets ./assets

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Build the image locally and verify fonts land at the expected path**

```bash
cd backend
docker build -t daylog-backend:plan-verify .
docker run --rm daylog-backend:plan-verify ls /app/assets/fonts
```

Expected: `Baloo2-Bold.ttf` and `Baloo2-Medium.ttf` listed.

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "build(backend): COPY assets/ into runtime image so fonts and soundtracks are available at runtime"
```

---

## Task 6: Manual visual verification

This task does not produce code. Skip it under CI but DO run it before merging — the per-item overlay is the change most likely to drift from the spec invisibly.

- [ ] **Step 1: Start the backend locally against the dev database**

```bash
cd backend
npm run dev   # or however the local dev server is started in this repo
```

- [ ] **Step 2: Trigger an export from a real or seeded account**

Either use the mobile app's export action, or hit the endpoint directly:

```bash
curl -OJ -H "Authorization: Bearer <DEV_JWT>" \
  "http://localhost:8080/stories/export?photo_ids=<id1>,<id2>"
```

- [ ] **Step 3: Compare with the mobile story-view side by side**

Open the resulting MP4 in QuickTime and the same day's story in the mobile app. For each frame, verify:

- Hour stamp position (centered, ~38% from top)
- Hour stamp typography (Baloo 2 Bold, white, soft dark halo — no yellow tint)
- Caption appears as static text below the time, no typewriter
- Caption truncates with `…` after two lines on long inputs
- Bottom scrim gradient looks roughly the same density as the story view
- Pagination dots are **not** present (intentional)
- Photo segments are 2 seconds each
- Video segments play their natural duration

If any of the above is wrong, do NOT lower the spec — open a follow-up that adjusts `exportOverlay.ts`. Common knobs:

- Hour position → `TIME_Y` constant
- Caption gap → `CAPTION_TOP = TIME_Y + 60` constant
- Caption line height → `CAPTION_LINE_HEIGHT`
- Shadow intensity → `shadowBlur` values

- [ ] **Step 4: Note any deltas in the PR description; do not commit the manual checklist itself.**

---

## Out-of-scope reminder

Anything in §2 of the spec ("Non-goals") MUST NOT sneak into this plan's implementation:

- No durable queue (Redis/pg-boss) — semaphore is in-process only.
- No async job + push notification UX.
- No streaming R2→ffmpeg stdin (we still write to disk).
- No upload of the output to R2.
- No typewriter animation in the export.
- No bumping the 30-item cap.

If reviewing your own diff you find any of those creeping in, remove them before opening the PR.

---

## Verification checklist (run before opening the PR)

- [ ] `cd backend && npm test` — all green, coverage thresholds met.
- [ ] `cd backend && npx tsc --noEmit` — typecheck clean.
- [ ] `docker build -t daylog-backend:export-v2 backend/` — image builds.
- [ ] Manual visual diff (Task 6) — done.
- [ ] One round of `git diff --stat` to confirm no stray files are staged.
