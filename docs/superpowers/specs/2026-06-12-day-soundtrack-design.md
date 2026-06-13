# Day Soundtrack — Design

**Date:** 2026-06-12
**Status:** Approved (design phase)
**Author:** andy (with Claude)

---

## 1. Context & Positioning Pivot

Daylog hiện định vị là "nhật ký video gia đình — quay dọc, lưu mãi". MVP chưa có lưu trữ chất lượng cao (deferred sang v2), vì vậy hook chính cho user chưa rõ ràng.

Pivot: **vẫn giữ flow capture hàng ngày, nhưng thêm "sản phẩm chia sẻ đẹp" làm differentiator**. Bước đầu tiên của pivot này: nâng cấp Story viewer hiện tại (đã playback ảnh/video tuần tự + đã có pipeline export MP4 server-side) thành **"Vlog có nhạc nền của ngày"**.

Đây là một positioning shift, không phải re-architecture. Capture flow, day grouping, album model, export pipeline đều giữ nguyên — chỉ thêm 1 lớp metadata (soundtrack) gắn với từng day.

## 2. Goals & Non-Goals

### Goals
- Mỗi day trong 1 album có thể được gán 1 soundtrack từ library bundled (5–10 tracks royalty-free).
- Story viewer phát soundtrack đồng thời với playback của ngày (video clips vẫn muted như hiện tại).
- Soundtrack lưu server-side, đồng bộ mọi member trong album — "ngày này có bài hát chung của gia đình".
- Export MP4 (đã có pipeline) có nhạc baked in.
- Module library reusable cho photobooth/vlog templates tương lai.

### Non-Goals (defer)
- Photobooth grid templates (2x2, hero+2, multi-page) — đã defer trong session brainstorm, để spec riêng sau.
- User upload custom track / dùng music từ thư viện máy.
- Premium gating (tất cả track free trong MVP).
- Ducking music khi clip có audio (clip muted, không cần).
- Real-time push khi member khác đổi track.
- Indicator trên Day Card trong day grid ("ngày này có nhạc") — chờ data sau MVP.

### Success metrics (kiểm sau ship)
- ≥30% day xem trong tuần đầu có soundtrack được pick.
- ≥1 export/user/tuần (vs baseline trước feature).

## 3. Architecture

```
┌──────────────────────────────┐         ┌──────────────────────────────────┐
│ Mobile (Story viewer)        │         │ Backend                          │
│                              │         │                                  │
│  useSoundtracks ──────────── │ ─GET──→ │ /soundtracks (list active)       │
│  useDaySoundtrack ────────── │ ─GET──→ │ /albums/:id/days/:date/soundtrack│
│  useSetDaySoundtrack ─────── │ ─PUT──→ │ (upsert day_soundtracks row)     │
│  useSoundtrackCache ──────── │ ─GET──→ │ /soundtracks/:key/file (mp3)     │
│  AudioPlayer (expo-audio) ←─ │  cache  │                                  │
│  useStoryExport ──────────── │ ─GET──→ │ /stories/export?...+soundtrack_id│
│                              │         │   └── ffmpeg add audio input     │
└──────────────────────────────┘         │       + map + -shortest          │
                                         └──────────────────────────────────┘

backend/assets/soundtracks/
  ├── lullaby_01.mp3
  ├── lullaby_02.mp3
  └── ...

Postgres
  ├── soundtracks (library catalog, seeded via migration)
  └── day_soundtracks (album_id, date) → soundtrack_id
```

Files là source-of-truth ở `backend/assets/soundtracks/`. Mobile cache về `FileSystem.cacheDirectory/soundtracks/` để play instant lần sau.

## 4. Data Model

### `soundtracks` (new)

```ts
soundtracks = pgTable('soundtracks', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  key: varchar('key', { length: 64 }).notNull().unique(),
  title: varchar('title', { length: 128 }).notNull(),
  artist: varchar('artist', { length: 128 }),
  durationMs: integer('duration_ms').notNull(),
  filePath: text('file_path').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

- `key`: stable identifier dùng cho cache key. Đổi nội dung file → phải đổi key (vd `lullaby_01_v2`).
- `file_path`: relative path so với `backend/assets/soundtracks/`, ví dụ `lullaby_01.mp3`.
- `is_active = false` để soft-disable mà không xoá row (day_soundtracks cũ vẫn reference được).
- Seed bằng data migration; không có UI admin tạo track.

### `day_soundtracks` (new)

```ts
day_soundtracks = pgTable('day_soundtracks', {
  id: uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
  albumId: uuid('album_id').notNull().references(() => albums.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  soundtrackId: uuid('soundtrack_id').notNull().references(() => soundtracks.id),
  updatedBy: uuid('updated_by').notNull().references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqAlbumDate: uniqueIndex('day_soundtracks_album_date_uniq').on(t.albumId, t.date),
}));
```

- Parallel với `day_labels` — cùng pattern `(album_id, date)`.
- No row = day silent (không bằng 1 row `null`).
- Upsert khi user đổi.

### Migration

1 migration `XXXX_add_soundtracks.sql`:
1. Create `soundtracks` table với indexes.
2. Create `day_soundtracks` table + FK + unique index.
3. Data seed: INSERT initial 5–10 rows. File mp3 phải có sẵn trong repo trước khi seed (ordering: file commit trước, migration sau).

## 5. Backend Implementation

### New file: `backend/src/routes/soundtracks.ts`

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/soundtracks` | List `is_active = true` tracks, sorted by `sortOrder`. Trả `{ id, key, title, artist, duration_ms }[]`. |
| `GET` | `/soundtracks/:key/file` | Lookup track by key, stream file từ `assets/soundtracks/<filePath>`. Headers: `Content-Type: audio/mpeg`, `Cache-Control: public, max-age=31536000, immutable`. 404 nếu key không tồn tại hoặc file missing. |
| `GET` | `/albums/:albumId/days/:date/soundtrack` | Check `album_members`. Trả soundtrack row (joined với `soundtracks` bảng) hoặc `null` (200, null hợp lệ). **Trả luôn cả khi `is_active = false`** — mobile cần phân biệt "chưa pick" vs "đã pick nhưng track đã bị disable" để hiện toast hợp lý. |
| `PUT` | `/albums/:albumId/days/:date/soundtrack` | Body `{ soundtrack_id }`. Verify soundtrack tồn tại + `is_active`. Upsert vào `day_soundtracks` (conflict on `(album_id, date)`). |
| `DELETE` | `/albums/:albumId/days/:date/soundtrack` | Xoá row khỏi `day_soundtracks`. Idempotent (404 nếu chưa có cũng OK, hoặc 204). |

Tất cả endpoints sau auth: `router.use(requireAuth)`. Day-level endpoints check `album_members` (precedent: `dayLabels`, `stories`).

Register router trong `backend/src/index.ts`.

### Modified: `backend/src/routes/stories.ts`

Thêm optional query param `soundtrack_id`:

```ts
const soundtrackId = req.query.soundtrack_id as string | undefined;
if (soundtrackId && !isValidUUID(soundtrackId)) {
  return res.status(400).json({ error: 'soundtrack_id invalid' });
}
```

Trước khi build ffmpeg args, fetch soundtrack:

```ts
let soundtrackPath: string | null = null;
if (soundtrackId) {
  const [track] = await db.select().from(soundtracks)
    .where(and(eq(soundtracks.id, soundtrackId), eq(soundtracks.isActive, true)));
  if (track) {
    soundtrackPath = path.join(__dirname, '../../assets/soundtracks', track.filePath);
    if (!fs.existsSync(soundtrackPath)) soundtrackPath = null;  // file missing → silent fallback
  }
}
```

Modify ffmpeg invocation:

```ts
const ffArgs: string[] = [];
for (const { filePath, mediaType } of localPaths) {
  if (mediaType === 'video') ffArgs.push('-i', filePath);
  else ffArgs.push('-loop', '1', '-t', '3', '-i', filePath);
}

if (soundtrackPath) {
  ffArgs.push('-stream_loop', '-1', '-i', soundtrackPath);
}

const videoCount = localPaths.length;
const filterParts = localPaths.map((_, i) =>
  `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,` +
  `pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1[v${i}]`
);
const concatInputs = localPaths.map((_, i) => `[v${i}]`).join('');
const filterParts2 = [
  ...filterParts,
  `${concatInputs}concat=n=${videoCount}:v=1:a=0[out]`,
];
if (soundtrackPath) {
  filterParts2.push(`[${videoCount}:a]volume=0.7[a]`);
}
const filterComplex = filterParts2.join('; ');

const finalArgs = [
  ...ffArgs,
  '-filter_complex', filterComplex,
  '-map', '[out]',
  ...(soundtrackPath ? ['-map', '[a]', '-c:a', 'aac', '-b:a', '128k', '-shortest'] : ['-an']),
  '-c:v', 'libx264',
  '-preset', 'fast',
  '-crf', '23',
  '-r', '30',
  '-y', outputPath,
];
```

Quan trọng: nếu `soundtrack_id` truyền vào nhưng track không tồn tại / inactive / file missing → **silent fallback** (giữ `-an`), không reject request. Đảm bảo export không fail vì soundtrack lỗi.

### Tests (backend uses `jest`)

**New: `backend/src/routes/soundtracks.test.ts`**
- `GET /soundtracks` trả only active tracks, sorted.
- `GET /soundtracks/:key/file` trả mp3 buffer với headers đúng; 404 cho key sai.
- `GET /albums/.../soundtrack`: trả null khi chưa pick; trả row khi có; 403 cho user khác album.
- `PUT`: upsert đúng (insert nếu chưa có, update nếu đã có); 400 cho soundtrack_id không tồn tại / inactive; 403 permission.
- `DELETE`: idempotent.

**Extend: `backend/src/routes/stories.test.ts`**
- Export không có `soundtrack_id` → ffmpeg gọi với `-an` (preserve hiện tại).
- Export với soundtrack_id valid → ffmpeg gọi với audio input + `-c:a aac` + `-shortest`.
- Export với soundtrack_id UUID không tồn tại → silent fallback (200, `-an`).
- Export với soundtrack_id `is_active = false` → silent fallback.

## 6. Mobile Implementation

### New dependency

```bash
npx expo install expo-audio
```

`expo-audio` đã stable từ SDK 53. Không gắn `expo-av` (legacy).

### New hooks (`mobile/src/hooks/`)

**`useSoundtracks.ts`** — list library:
```ts
export function useSoundtracks() {
  return useQuery({
    queryKey: ['soundtracks'],
    queryFn: () => api.get<Soundtrack[]>('/soundtracks').then(r => r.data),
    staleTime: Infinity,  // library rarely changes; force refresh via invalidate if needed
  });
}
```

**`useDaySoundtrack.ts`** — fetch current day's track:
```ts
export function useDaySoundtrack(albumId: string | null, date: string | null) {
  return useQuery<Soundtrack | null>({
    queryKey: ['day-soundtrack', albumId, date],
    queryFn: () => api.get(`/albums/${albumId}/days/${date}/soundtrack`).then(r => r.data),
    enabled: !!albumId && !!date,
  });
}
```

**`useSetDaySoundtrack.ts`** — mutation:
```ts
export function useSetDaySoundtrack(albumId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (soundtrackId: string | null) => {
      if (soundtrackId === null) {
        await api.delete(`/albums/${albumId}/days/${date}/soundtrack`);
      } else {
        await api.put(`/albums/${albumId}/days/${date}/soundtrack`, { soundtrack_id: soundtrackId });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['day-soundtrack', albumId, date] }),
  });
}
```

**`useSoundtrackCache.ts`** — local FS cache:
```ts
export function useSoundtrackCache() {
  const cacheDir = `${FileSystem.cacheDirectory}soundtracks/`;
  async function ensure(key: string): Promise<string> {
    const localUri = `${cacheDir}${key}.mp3`;
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) return localUri;
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    const result = await FileSystem.downloadAsync(
      `${API_URL}/soundtracks/${encodeURIComponent(key)}/file`,
      localUri,
    );
    if (result.status !== 200) throw new Error(`fetch soundtrack ${key} failed`);
    return localUri;
  }
  return { ensure };
}
```

### Story viewer integration (`mobile/app/story/[albumId]/[date].tsx`)

Thêm vào existing component:

```ts
const { data: daySoundtrack } = useDaySoundtrack(albumId, date);
const cache = useSoundtrackCache();
const audioPlayer = useAudioPlayer(null);

// Load + play soundtrack khi day's track thay đổi
useEffect(() => {
  if (!daySoundtrack) {
    audioPlayer.pause();
    audioPlayer.replace(null);
    return;
  }
  let cancelled = false;
  cache.ensure(daySoundtrack.key).then((uri) => {
    if (cancelled) return;
    audioPlayer.replace(uri);
    audioPlayer.loop = true;
    audioPlayer.volume = 0.7;
    if (!isPaused) audioPlayer.play();
  }).catch(() => {
    // Offline + uncached → silent
  });
  return () => { cancelled = true; };
}, [daySoundtrack?.key]);

// Sync với story pause/play
useEffect(() => {
  if (!daySoundtrack) return;
  if (isPaused) audioPlayer.pause();
  else audioPlayer.play();
}, [isPaused, daySoundtrack?.id]);

// Cleanup
useEffect(() => () => {
  audioPlayer.pause();
  audioPlayer.replace(null);
}, []);
```

Prefetch toàn library khi vào story (background, fire-and-forget):
```ts
useEffect(() => {
  if (!library) return;
  library.forEach((t) => cache.ensure(t.key).catch(() => {}));
}, [library]);
```

### Track picker UI

**New component:** `mobile/src/components/story/SoundtrackPickerSheet.tsx`

Bottom sheet (StickerCard style để khớp Sticker World):
- Header: "Nhạc nền cho ngày DD.MM.YYYY"
- "Tắt nhạc" item (highlighted nếu day hiện không có track)
- List tracks từ `useSoundtracks()`:
  - Checkmark trên track đang chọn
  - Preview button (▶) — secondary `useAudioPlayer` riêng, phát 10s rồi tự dừng
  - Tap row = call `useSetDaySoundtrack().mutate(track.id)` + đóng sheet
- "Đang lưu..." chip giống pattern `manage.tsx` khi save caption

**Entry point:** thêm vào dropdown "..." của Story viewer, **sau "Sửa ghi chú"**:

```tsx
<TouchableOpacity
  style={styles.menuItem}
  testID="story-menu-soundtrack"
  onPress={() => { setMenuOpen(false); setSoundtrackPickerOpen(true); }}
>
  <MusicNotesIcon size={16} color={theme.colors.textPrimary} />
  <Text style={styles.menuItemText}>Nhạc nền</Text>
</TouchableOpacity>
```

(`MusicNotesIcon` từ `phosphor-react-native` — đã dùng.)

### Export integration

Modify `useStoryExport`:

```ts
export function useStoryExport(
  photos: DayPhoto[],
  date: string,
  soundtrackId?: string | null,    // NEW
) {
  // ...
  const url = `${API_URL}/stories/export?photo_ids=${encodeURIComponent(photoIds)}`
    + (soundtrackId ? `&soundtrack_id=${soundtrackId}` : '');
  // ...
}
```

Caller (`[date].tsx`):
```ts
const { exporting, exportStory } = useStoryExport(photos ?? [], date, daySoundtrack?.id);
```

### Tests (mobile uses `jest`)

**Hooks:** `useSoundtracks`, `useDaySoundtrack`, `useSetDaySoundtrack`, `useSoundtrackCache` — mock `axios` + `expo-file-system`.

**Component:** `SoundtrackPickerSheet.test.tsx`:
- Render danh sách + checkmark đúng track đang chọn.
- Tap row → mutation called với đúng id.
- "Tắt nhạc" → mutation called với null.
- Preview button không trigger mutation.

**Integration:** `app/story/[albumId]/[date].test.tsx`:
- Mount với day có soundtrack → expect `audioPlayer.play()` called sau khi cache resolve.
- `isPaused = true` → expect `audioPlayer.pause()` called.
- Unmount → expect `audioPlayer.replace(null)` (cleanup).

## 7. Edge Cases

| Tình huống | Behavior |
|---|---|
| Day chưa pick soundtrack | Story silent. Menu vẫn show "Nhạc nền" để user có thể pick. |
| Track `is_active = false` ở server | `useSoundtracks()` không list. Day vẫn có row trỏ tới track inactive → mobile silent + toast "Track không còn — chọn lại". Export: silent fallback. |
| Mobile offline + track chưa cache | `cache.ensure()` reject → silent + log error (không crash). |
| Track ngắn hơn story | Mobile: `audioPlayer.loop = true`. Backend: `-stream_loop -1` + `-shortest`. |
| Track dài hơn story | Mobile: dừng khi user rời story. Backend: `-shortest` cắt. |
| Album member khác đổi track khi đang xem | React-query refetch khi day mount lại / pull-to-refresh. Không real-time. |
| User pause story | Music pause cùng. |
| Story unmount giữa chừng | Cleanup pause + replace null. Không leak audio session. |
| Export thiếu `soundtrack_id` | Backend giữ flow cũ (`-an`). |
| Backend file mp3 missing dù DB có row | Backend silent fallback (kiểm `fs.existsSync`). Mobile fetch endpoint trả 404 → cache.ensure reject → silent. |

## 8. Open Items (sẽ chốt trước implementation)

1. **Initial track list & licensing.** Cần 5–10 track royalty-free. Nguồn: Pixabay Music, Free Music Archive, hoặc commission. Deliverable riêng, không block implementation — placeholder bằng silent track 30s để bootstrap.
2. **Music volume hardcode = 0.7.** Có thể chỉnh sau dựa trên feedback.
3. **Day Card indicator** ("ngày này có nhạc") — không trong MVP. Đánh giá lại sau.

## 9. Future Work (post-MVP)

- Photobooth grid templates (2x2, hero+2) sử dụng cùng `soundtracks` library — spec riêng.
- Fade in/out + custom start offset cho music.
- R2 migration cho library khi >20 tracks hoặc >100MB.
- Real-time sync (push/SSE) khi member khác đổi track.
- Premium gating: free vs premium tracks.
- Day Card indicator nếu user feedback cho thấy cần.
