# Export Pipeline v2 — Server-Side Stability + Story-View Visual Match

**Status**: Design — pending review
**Date**: 2026-06-12
**Owner**: andy
**Affected service**: `backend` (Express). Mobile contract unchanged.

## 1. Goal

Make `GET /stories/export` resilient under concurrent load and render output that visually matches the mobile story-view (hour stamp + caption, minus typewriter animation). Keep the wire protocol sync — one HTTP request, one MP4 response — so the mobile client needs no changes.

## 2. Non-goals

- Durable cross-restart job queue (Redis / pg-boss). Deferred — current scale is MVP.
- Async job + push-notification UX. Deferred for the same reason.
- Lifting the 30-item cap. Cap stays; protects ffmpeg duration ceiling.
- Streaming R2 → ffmpeg stdin (skipping disk). Adds complexity for no MVP-grade benefit.
- Output upload to R2 + signed URL. Direct response stream is sufficient.
- Replaying typewriter animation on the caption. Caption renders **static** (full text from frame 0). The story-view animation is too tightly coupled to React-Native-Reanimated to replicate cheaply in ffmpeg/canvas.
- Pagination dots at the bottom of story-view — meaningless in a linear video, omit.

## 3. Two intertwined changes in one spec

This spec covers two changes together because both rewrite the same handler:

- **Stability** — concurrency control, streaming output, abort-on-disconnect, ffmpeg timeout, cleanup guarantees.
- **Visual parity** — per-item overlay (hour string + static caption + bottom gradient) baked into the rendered output.

Either change alone touches `routes/stories.ts` heavily; bundling avoids two large rewrites.

## 4. Architecture

```
[Mobile] ──GET /stories/export?photo_ids=…&soundtrack_id=…──▶ [Express]
                                                                 │
                                              (1) checkQueueDepth — 429 if total > MAX_QUEUE
                                                                 │
                                                                 ▼
                                                  [ffmpeg semaphore — N=2]
                                                  acquire() — request waits in event loop
                                                                 │
                                                                 ▼
                                                  (2) parallelDownload (p-limit=4)
                                                        R2 → /tmp/<job>/raw/NNN.{webp|mp4}
                                                                 │
                                                                 ▼
                                                  (3) renderOverlays  (parallel, canvas)
                                                        per item → /tmp/<job>/ov/NNN.png
                                                                 │
                                                                 ▼
                                                  (4) ffmpeg execFile
                                                        AbortController bound to req.close + 180s timeout
                                                        composites overlay onto every photo/video
                                                        concats → output.mp4
                                                                 │
                                                                 ▼
                                                  (5) fs.createReadStream(mp4).pipe(res)
                                                                 │
                                                                 ▼
                                                  finally:
                                                        - rm -rf /tmp/<job>
                                                        - semaphore.release()
```

### Concurrency control

`backend/src/services/exportQueue.ts` (new):

- One module-level `p-limit(2)` instance — the ffmpeg gate. Wrapped in `withExportSlot(fn)` so callers can be agnostic of internal state.
- One module-level `pendingCount` (incremented on entry, decremented on exit) — covers both running and waiting requests. If `pendingCount > 4` at entry, throw `QueueFullError` immediately so the handler can send `429 Too Many Requests` with `Retry-After: 30`.
- `N=2, MAX_QUEUE=4` chosen for a 2–4 vCPU container (Render/Fly small): two ffmpeg jobs roughly saturate CPU; two more queued is a useful smoothing buffer without unbounded memory growth. Both constants live in one file and are easy to tune later.
- No cross-process awareness — single-pod assumption. If we deploy multiple replicas later we'll either (a) accept that each pod has its own gate or (b) move to durable queue (out of scope here).

### Per-job lifecycle

In the handler (`backend/src/routes/stories.ts`):

1. Parse + auth check (unchanged).
2. Create `AbortController` `ac`. Bind:
   - `req.on('close', () => ac.abort('client-closed'))` — kills ffmpeg if mobile cancels.
   - `setTimeout(() => ac.abort('timeout'), 180_000)` — hard ceiling per job.
3. Enter `withExportSlot(async () => { … })`. Inside:
   - Create `tempDir = path.join(os.tmpdir(), 'story-export-' + randomUUID())`.
   - Download media in parallel (see below).
   - Render overlays in parallel (see below).
   - Invoke ffmpeg with `execFile(ffmpegPath, args, { signal: ac.signal, killSignal: 'SIGKILL' })`.
   - Stream output to response.
4. `finally`: `await fs.promises.rm(tempDir, { recursive: true, force: true })`. Wrapped in its own try/catch so cleanup failure doesn't mask the real error.
5. Handle abort: if `ac.signal.aborted` for `timeout` reason → `504`; for `client-closed` we simply stop — the socket is gone, no response needed.

### Parallel R2 download

`p-limit(4)` over the photo list. Each task: `getObjectBuffer(r2Key)` → `fs.promises.writeFile(rawPath, buf)`. Sequential download of 30 items currently dominates wall time; this collapses it to ~ceil(30/4) RTTs.

We keep buffer-then-write rather than streaming to disk because `getObjectBuffer` already exists and the per-photo size (~200KB image, ~2–5MB short video) is well within safe memory. Stream-to-disk is a future optimisation if items grow.

### Overlay rendering (story-view visual match)

New module `backend/src/services/exportOverlay.ts`:

- One PNG per item, 1080×1920, transparent background, written to `/tmp/<job>/ov/NNN.png`.
- Library: **`@napi-rs/canvas`** (native binding, no system deps, supports `registerFont`).
- Font: bundle **Baloo 2 Bold** + **Baloo 2 Medium** TTF files in `backend/assets/fonts/`. Register once at process start (idempotent).
- Composition per item:
  - **Hour stamp** — `formatInTimeZone(taken_at, 'Asia/Ho_Chi_Minh', 'HH:mm')`. Drawn centered at y ≈ 38% × 1920 = 730px.
    - Font: Baloo 2 Bold, **size 56px** (≈ 20pt at story-view scale × 1080/390 device-width ratio).
    - Fill: `#FFFFFF`. Shadow: `rgba(0,0,0,0.85)`, blur radius 22, offset (0,0).
  - **Caption** — `photo.caption?.trim()`, rendered if non-empty.
    - Font: Baloo 2 Medium, **size 50px** (≈ 18pt × 2.77 scale).
    - Centered horizontally; word-wrapped to max 80% width (≈ 864px); max two lines (truncate with `…`).
    - Vertical anchor: 8px below the hour stamp baseline.
    - Fill: `#FFFFFF`. Shadow: same as above.
  - **Bottom scrim** — linear gradient drawn from y=1280 to y=1920: `transparent` → `rgba(0,0,0,0.55)` → `rgba(0,0,0,0.82)`. Matches story-view's `LinearGradient`. Painted into the overlay PNG, not via ffmpeg filter — cheaper and identical result.
  - Pagination dots: **omitted**.

Rendering is parallelisable (CPU-bound, no I/O) — wrap with `p-limit(4)` so 30 items take ~ceil(30/4) × ~50ms ≈ 400ms total instead of 1.5s sequential.

### ffmpeg invocation

Old graph (concat with scale/pad only) becomes:

```
For input pair (media[i], overlay[i]):
  [i:v] scale=1080:1920:force_original_aspect_ratio=decrease,
         pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,
         setsar=1
         [base_i];
  [base_i][ov_i:v] overlay=0:0 [v_i];

[v_0][v_1]…[v_29] concat=n=30:v=1:a=0 [vout]
```

Implementation notes:

- Photo inputs use `-loop 1 -t 2` (2s display — changed from 3s).
- Video inputs use direct read; trim if longer than the natural clip length using `-t` based on probed duration. Capture flow already enforces 2s cap so this is a belt-and-braces guard.
- Overlay inputs (`-i overlay.png`) follow all media inputs. Filter graph references them as `[N+i:v]` where `N` = media count.
- Audio: same as today. `-stream_loop -1 -i soundtrack.mp3` mixed in if provided; otherwise no audio.
- Encoding: keep `libx264 -preset fast -crf 23 -r 30 -pix_fmt yuv420p`. `-movflags +faststart` so the streamed MP4 starts playing before fully buffered.

### Streaming the response

```ts
const stat = await fs.promises.stat(outputPath);
res.setHeader('Content-Type', 'video/mp4');
res.setHeader('Content-Length', String(stat.size));
await pipeline(fs.createReadStream(outputPath), res);
```

`pipeline` (from `node:stream/promises`) propagates errors and waits for backpressure. No more peak RAM = sizeof(MP4).

### Observability

Sentry breadcrumbs + structured logs at:

- `export.gate.wait` — `{ pendingCount, slotsInUse }` — only when actually waiting (>10ms in `acquire`).
- `export.start` — `{ userId, itemCount, hasSoundtrack, queueWaitMs }`.
- `export.complete` — `{ durationMs, mp4Bytes, ffmpegMs, overlayMs, downloadMs }`.
- `export.fail` — `{ stage: 'download'|'overlay'|'ffmpeg'|'stream', err, reason }`.
- `export.abort` — `{ reason: 'client-closed'|'timeout', stage }`.

These are enough to see whether queue saturation, ffmpeg duration, or R2 latency drives any future incident.

## 5. Files touched

| Path | Change |
|---|---|
| `backend/src/services/exportQueue.ts` | new — `withExportSlot`, `QueueFullError`, constants `N=2`, `MAX_QUEUE=4` |
| `backend/src/services/exportOverlay.ts` | new — `renderOverlayPng({ takenAt, caption })` using `@napi-rs/canvas` |
| `backend/src/services/exportPipeline.ts` | new — orchestrates download + overlay + ffmpeg + stream; keeps the route handler thin |
| `backend/src/routes/stories.ts` | rewrite the export handler; ~150 LOC → ~60 LOC delegating to `exportPipeline` |
| `backend/assets/fonts/Baloo2-Bold.ttf` | new — bundled font |
| `backend/assets/fonts/Baloo2-Medium.ttf` | new — bundled font |
| `backend/Dockerfile` | copy `assets/` into runtime image |
| `backend/package.json` | add `@napi-rs/canvas`, `p-limit`, `date-fns-tz` (for `formatInTimeZone`) |
| `backend/tests/routes/stories.export.test.ts` | extend existing tests: queue-full path → 429; abort propagation; overlay PNG produced |

Mobile: **no change.**

## 6. Error handling matrix

| Failure | Detection | Response |
|---|---|---|
| Queue full (`pendingCount > 4`) | `QueueFullError` in handler | `429 Too Many Requests`, `Retry-After: 30` |
| R2 download fails | `getObjectBuffer` rejects | `502 Bad Gateway`, log stage='download' |
| Overlay render fails | canvas throws | `500`, log stage='overlay'. Should never happen with valid inputs — bug-class. |
| ffmpeg exits non-zero | `execFile` rejects | `500`, log stderr + stage='ffmpeg' |
| Hits 180s timeout | `ac.abort('timeout')` | `504 Gateway Timeout` |
| Client closes early | `ac.abort('client-closed')` | no response — socket already gone |
| Stream pipe fails mid-response | `pipeline` rejects | response already partial; log + swallow |
| Cleanup fails | inner try/catch on `rm -rf` | log warning; primary error/response unaffected |

## 7. Test plan

- Unit: `exportQueue.test.ts` — N=2 ⇒ third call waits; MAX_QUEUE=4 ⇒ fifth call throws `QueueFullError` immediately.
- Unit: `exportOverlay.test.ts` — given `(takenAt, caption)`, output PNG is 1080×1920 with non-zero alpha pixels around the expected text bbox. Snapshot one rendered PNG and pixel-diff with a 2% tolerance.
- Integration: existing `stories.export.test.ts` — extend to assert response streams (not `Buffer.from(body)` materialisation in fixture).
- Manual: 30-photo export with captions of varying length; eyeball against the mobile story-view by playing both side-by-side.
- Load (one-off, not CI): 6 concurrent requests via `oha`. Expect 4 to succeed, 2 to return 429.

## 8. Open questions

- **Font licensing**: Baloo 2 is Open Font License — safe to bundle in the Docker image. Confirm with `mobile/assets/fonts/` source.
- **Timezone**: hardcoded `Asia/Ho_Chi_Minh` for the hour stamp. If we ever serve users in other regions we'd thread the user's timezone through the request. Out of scope today.
- **Caption ellipsis**: at length > ~30 chars on two lines, we truncate with `…`. Mobile currently `maxLength={50}` so this rarely fires; mention it in PR.

## 9. Rollout

Single deploy. Feature is server-internal; no flag needed. After ship:

1. Trigger one manual export and screenshot first frame vs. story-view first frame in mobile — confirm overlay parity.
2. Watch Sentry for `export.fail`/`export.abort` for 24h.
3. Note p95 `durationMs` from `export.complete` traces — guide for whether to bump `N` or `MAX_QUEUE` later.
