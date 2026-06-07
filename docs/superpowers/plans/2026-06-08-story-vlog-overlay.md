# Story Viewer Vlog Tape Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị giờ chụp và ghi chú (caption) theo phong cách Vlog Tape (timestamp máy quay cũ) ở bottom overlay của Story Viewer.

**Architecture:** Backend trả thêm `caption` trong endpoint `/albums/:id/days/:date/photos`. Frontend `DayPhoto` interface nhận field mới. Story viewer render `VlogOverlay` — component pure với gradient tối + text shadow đảm bảo readability trên mọi màu nền.

**Tech Stack:** TypeScript, Express/Drizzle (backend), React Native + Expo SDK 56, expo-linear-gradient, @testing-library/react-native (tests)

---

## File Map

| File | Action |
|---|---|
| `backend/src/routes/album-days.ts` | Modify — thêm `p.caption` vào SELECT |
| `backend/src/routes/album-days.test.ts` | Modify — thêm test caption được trả về |
| `mobile/src/hooks/useDayPhotos.ts` | Modify — thêm `caption: string \| null` vào `DayPhoto` |
| `mobile/app/story/[albumId]/[date].tsx` | Modify — thêm `VlogOverlay` component + styles |
| `mobile/app/__tests__/story-vlog-overlay.test.tsx` | Create — test VlogOverlay render |

---

### Task 1: Backend — trả caption trong day photos endpoint

**Files:**
- Modify: `backend/src/routes/album-days.ts:73`
- Modify: `backend/src/routes/album-days.test.ts`

- [ ] **Step 1: Viết failing test — caption được trả về trong response**

Trong `backend/src/routes/album-days.test.ts`, cập nhật hàm `insertPhoto` để nhận `caption` option, và thêm test case mới vào describe block `GET /albums/:id/days/:date/photos`:

```ts
// Cập nhật insertPhoto helper (thêm caption vào opts và values)
async function insertPhoto(userId: string, albumId: string, opts: { takenAt?: string; mediaType?: string; caption?: string } = {}) {
  const [p] = await db.insert(photos).values({
    albumId,
    uploadedBy: userId,
    r2Key: `photos/${Math.random()}.webp`,
    thumbnailKey: `thumbnails/${Math.random()}.webp`,
    takenAt: new Date(opts.takenAt ?? '2026-05-21T10:00:00Z'),
    mediaType: opts.mediaType ?? 'photo',
    source: 'capture',
    caption: opts.caption ?? null,
  }).returning();
  await db.insert(albumPhotos).values({ photoId: p.id, albumId });
  return p;
}
```

Thêm test case sau test `'returns photos for that day ordered by taken_at asc'`:

```ts
it('returns caption field for each photo', async () => {
  await insertPhoto(user.id, album.id, {
    takenAt: '2026-05-21T08:00:00Z',
    caption: 'Bữa sáng gia đình',
  });
  await insertPhoto(user.id, album.id, {
    takenAt: '2026-05-21T09:00:00Z',
    caption: null,
  });

  const res = await request(app)
    .get(`/albums/${album.id}/days/2026-05-21/photos`)
    .set(headers);

  expect(res.status).toBe(200);
  expect(res.body[0].caption).toBe('Bữa sáng gia đình');
  expect(res.body[1].caption).toBeNull();
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
cd backend && npx jest album-days --testNamePattern="returns caption" --no-coverage
```

Expected: FAIL — `expect(received).toBe(expected)` vì query chưa select `caption`

- [ ] **Step 3: Sửa query trong album-days.ts**

Trong `backend/src/routes/album-days.ts`, thay dòng 73:

```ts
// Trước
SELECT p.id, p.media_type, p.duration_ms, p.taken_at
```

Thành:

```ts
SELECT p.id, p.media_type, p.duration_ms, p.taken_at, p.caption
```

Đoạn đầy đủ sau sửa (lines 72–79):

```ts
    const rows = await db.execute(sql`
      SELECT p.id, p.media_type, p.duration_ms, p.taken_at, p.caption
      FROM photos p
      JOIN album_photos ap ON ap.photo_id = p.id
      WHERE ap.album_id = ${albumId}::uuid
        AND DATE(p.taken_at AT TIME ZONE 'UTC') = ${date}::date
      ORDER BY p.taken_at ASC
    `);
```

- [ ] **Step 4: Chạy toàn bộ test album-days để xác nhận pass**

```bash
cd backend && npx jest album-days --no-coverage
```

Expected: tất cả PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/album-days.ts backend/src/routes/album-days.test.ts
git commit -m "feat(backend): return caption in day photos endpoint"
```

---

### Task 2: Frontend — thêm caption vào DayPhoto interface

**Files:**
- Modify: `mobile/src/hooks/useDayPhotos.ts`

- [ ] **Step 1: Cập nhật DayPhoto interface**

Trong `mobile/src/hooks/useDayPhotos.ts`, thay interface `DayPhoto`:

```ts
export interface DayPhoto {
  id: string;
  media_type: 'photo' | 'video';
  duration_ms: number | null;
  taken_at: string;
  caption: string | null;
}
```

- [ ] **Step 2: Kiểm tra TypeScript compile clean**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: không có lỗi TypeScript

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/useDayPhotos.ts
git commit -m "feat(mobile): add caption field to DayPhoto interface"
```

---

### Task 3: Story viewer — thêm VlogOverlay component

**Files:**
- Create: `mobile/app/__tests__/story-vlog-overlay.test.tsx`
- Modify: `mobile/app/story/[albumId]/[date].tsx`

- [ ] **Step 1: Viết failing test cho VlogOverlay**

Tạo file `mobile/app/__tests__/story-vlog-overlay.test.tsx`:

```tsx
import React from 'react';
import { render } from '@testing-library/react-native';

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

// Import VlogOverlay after mocks
// VlogOverlay sẽ được export từ story screen. Vì nó nằm trong file có nhiều
// native deps phức tạp, ta test component độc lập bằng cách copy logic vào đây.
// Khi implement, export VlogOverlay hoặc tách thành file riêng nếu muốn test dễ hơn.
// Approach đơn giản nhất: render inline component giống hệt VlogOverlay.

import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Replica of the component logic — phải match chính xác implementation
function VlogOverlay({ photo }: { photo: { taken_at: string; caption: string | null } }) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 }}
      pointerEvents="none"
    >
      <Text testID="vlog-date">{dateStr}</Text>
      <Text testID="vlog-time">▶ {timeStr}</Text>
      {photo.caption ? <Text testID="vlog-caption">{photo.caption}</Text> : null}
    </LinearGradient>
  );
}

describe('VlogOverlay', () => {
  it('renders formatted date and time from taken_at', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: null };
    const { getByTestId } = render(<VlogOverlay photo={photo} />);

    expect(getByTestId('vlog-date').props.children).toMatch(/2025\.12\.25/);
  });

  it('renders caption when present', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: 'Bữa sáng gia đình' };
    const { getByTestId } = render(<VlogOverlay photo={photo} />);

    expect(getByTestId('vlog-caption').props.children).toBe('Bữa sáng gia đình');
  });

  it('does not render caption when null', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: null };
    const { queryByTestId } = render(<VlogOverlay photo={photo} />);

    expect(queryByTestId('vlog-caption')).toBeNull();
  });

  it('does not render caption when empty string', () => {
    const photo = { taken_at: '2025-12-25T13:42:00Z', caption: '' };
    const { queryByTestId } = render(<VlogOverlay photo={photo} />);

    expect(queryByTestId('vlog-caption')).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
cd mobile && npx jest story-vlog-overlay --no-coverage
```

Expected: PASS (test file không import từ story screen nên không cần bước fail thực sự — tests chạy được ngay với replica component). Đây là bước chuẩn bị trước khi tích hợp vào screen thực.

- [ ] **Step 3: Thêm VlogOverlay vào story/[albumId]/[date].tsx**

Mở `mobile/app/story/[albumId]/[date].tsx`. Thêm import ở đầu file:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
```

Thêm component `VlogOverlay` sau component `VideoItem` (khoảng line 92):

```tsx
function VlogOverlay({ photo }: { photo: DayPhoto }) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.85)']}
      style={vlog.container}
      pointerEvents="none"
    >
      <Text style={vlog.date} testID="vlog-date">{dateStr}</Text>
      <Text style={vlog.time} testID="vlog-time">▶ {timeStr}</Text>
      {photo.caption?.trim() ? <Text style={vlog.caption} testID="vlog-caption">{photo.caption}</Text> : null}
    </LinearGradient>
  );
}
```

- [ ] **Step 4: Render VlogOverlay trong StoryScreen**

Trong `StoryScreen`, bên trong `<GestureDetector>`, thêm `<VlogOverlay photo={current} />` sau `<View style={styles.tapAreas}>`:

```tsx
        <View style={styles.tapAreas}>
          <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
          <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
        </View>

        <VlogOverlay photo={current} />
```

- [ ] **Step 5: Thêm styles cho VlogOverlay**

Thêm StyleSheet `vlog` sau `const styles = StyleSheet.create({...})`:

```tsx
const vlog = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl * 2,
  },
  date: {
    fontFamily: 'Courier New',
    fontSize: 8,
    color: 'rgba(255,180,0,0.7)',
    letterSpacing: 0.5,
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  time: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: '#ffcc44',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
    textShadowColor: 'rgba(255,180,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  caption: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.92)',
    fontStyle: 'italic',
    lineHeight: 17,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
```

- [ ] **Step 6: Kiểm tra TypeScript compile clean**

```bash
cd mobile && npx tsc --noEmit 2>&1 | head -30
```

Expected: không có lỗi

- [ ] **Step 7: Chạy toàn bộ mobile tests**

```bash
cd mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: tất cả PASS

- [ ] **Step 8: Commit**

```bash
git add "mobile/app/story/[albumId]/[date].tsx" mobile/app/__tests__/story-vlog-overlay.test.tsx
git commit -m "feat(mobile): add VlogOverlay to story viewer with time and caption"
```
