# Engagement Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build hai cơ chế engagement: (A) Reaction system — phụ huynh react emoji vào ảnh, tạo feedback loop bố↔mẹ qua push notification; (B) Storage Freedom — sau khi ảnh đã sync, hiện badge thụ động để user xoá local và giải phóng bộ nhớ.

**Architecture:** 
- Part A (Reactions): backend route mới `/photos/:id/reactions` + bảng `reactions` trong DB + mobile hook + 2 component mới (ReactionPicker popover, ReactionBadge overlay). PhotoCell nhận thêm `onLongPress` để mở picker.
- Part B (Storage Freedom): `uploadStore` (Zustand) track localAssetId + compressedBytes của mỗi ảnh đã sync thành công → hiện `StorageBadge` trên home screen → modal confirm → xoá qua `expo-media-library`.

**Tech Stack:** Drizzle ORM, Express.js, React Native, Zustand, expo-media-library (cần cài thêm), TanStack Query

---

## PART A — REACTIONS

---

### Task 1: Backend — Thêm bảng reactions vào schema

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Thêm reactions table vào schema**

Thêm vào cuối `backend/src/db/schema.ts`, sau phần `invites`:

```ts
export const reactions = pgTable(
  'reactions',
  {
    id:        uuid('id').primaryKey().default(sql`uuid_generate_v4()`),
    photoId:   uuid('photo_id').notNull().references(() => photos.id, { onDelete: 'cascade' }),
    userId:    uuid('user_id').notNull().references(() => users.id),
    emoji:     varchar('emoji', { length: 8 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniqPhotoUser: uniqueIndex('reactions_photo_user_uniq').on(t.photoId, t.userId),
    byPhoto:       index('idx_reactions_photo').on(t.photoId),
  })
);
```

- [ ] **Step 2: Generate migration**

```bash
cd backend && npm run migrate:generate
```

Expected: tạo file mới trong `src/db/migrations/` (tên dạng `0001_*.sql`)

- [ ] **Step 3: Verify migration SQL có đủ CREATE TABLE + UNIQUE INDEX**

Mở file migration vừa generate, kiểm tra:
- Có `CREATE TABLE "reactions"` với 5 columns
- Có `CREATE UNIQUE INDEX "reactions_photo_user_uniq"`
- Có `CREATE INDEX "idx_reactions_photo"`

- [ ] **Step 4: Commit**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations/
git commit -m "feat(backend/db): add reactions table"
```

---

### Task 2: Backend — Reactions route

**Files:**
- Create: `backend/src/routes/reactions.ts`

- [ ] **Step 1: Tạo file route**

Tạo `backend/src/routes/reactions.ts`:

```ts
import express, { Request, Response, NextFunction } from 'express';
import { and, eq, sql } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth';
import { db } from '../db';
import { photos, albumMembers, users, reactions } from '../db/schema';
import { sendPush } from '../services/apns';

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

const VALID_EMOJIS = new Set(['❤️', '😂', '😍', '🥹']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function getPhotoWithAlbum(photoId: string) {
  const rows = await db
    .select({ albumId: photos.albumId, uploadedBy: photos.uploadedBy })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  return rows[0] ?? null;
}

async function requireAlbumMember(albumId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ x: sql<number>`1` })
    .from(albumMembers)
    .where(and(eq(albumMembers.albumId, albumId), eq(albumMembers.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

// GET /photos/:photoId/reactions → [{ emoji, count }]
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoId } = req.params;
    if (!UUID_RE.test(photoId)) return res.status(400).json({ error: 'Invalid photoId' });

    const photo = await getPhotoWithAlbum(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (!(await requireAlbumMember(photo.albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({ emoji: reactions.emoji, count: sql<number>`cast(count(*) as int)` })
      .from(reactions)
      .where(eq(reactions.photoId, photoId))
      .groupBy(reactions.emoji)
      .orderBy(sql`count(*) desc`);

    return res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /photos/:photoId/reactions  body: { emoji }
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoId } = req.params;
    const { emoji } = req.body ?? {};

    if (!UUID_RE.test(photoId)) return res.status(400).json({ error: 'Invalid photoId' });
    if (!VALID_EMOJIS.has(emoji)) return res.status(400).json({ error: 'Invalid emoji' });

    const photo = await getPhotoWithAlbum(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (!(await requireAlbumMember(photo.albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db
      .insert(reactions)
      .values({ photoId, userId: req.user!.id, emoji })
      .onConflictDoUpdate({
        target: [reactions.photoId, reactions.userId],
        set: { emoji, createdAt: sql`now()` },
      });

    // Push to uploader (skip if reactor is uploader)
    if (photo.uploadedBy !== req.user!.id) {
      const uploaderRows = await db
        .select({ apnsToken: users.apnsToken })
        .from(users)
        .where(eq(users.id, photo.uploadedBy))
        .limit(1);
      const token = uploaderRows[0]?.apnsToken;
      if (token) {
        sendPush(
          [token],
          `${req.user!.displayName} đã react ảnh của bé`,
          `${req.user!.displayName} đã gửi ${emoji}`,
          { photoId }
        ).catch(console.error);
      }
    }

    return res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /photos/:photoId/reactions
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { photoId } = req.params;
    if (!UUID_RE.test(photoId)) return res.status(400).json({ error: 'Invalid photoId' });

    const photo = await getPhotoWithAlbum(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    if (!(await requireAlbumMember(photo.albumId, req.user!.id))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await db
      .delete(reactions)
      .where(and(eq(reactions.photoId, photoId), eq(reactions.userId, req.user!.id)));

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
```

- [ ] **Step 2: Registreer route trong app.ts**

Mở `backend/src/app.ts`, thêm import và mount:

```ts
import reactionsRoutes from './routes/reactions';
```

Thêm sau dòng `app.use('/photos', photosRoutes);`:

```ts
app.use('/photos/:photoId/reactions', reactionsRoutes);
```

- [ ] **Step 3: Build để check TypeScript errors**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/reactions.ts backend/src/app.ts
git commit -m "feat(backend): add reactions route (GET/POST/DELETE)"
```

---

### Task 3: Backend — Reactions route tests

**Files:**
- Create: `backend/src/routes/reactions.test.ts`

- [ ] **Step 1: Tạo test file**

Tạo `backend/src/routes/reactions.test.ts`:

```ts
jest.mock('../services/apns', () => ({ sendPush: jest.fn().mockResolvedValue(undefined) }));

import request from 'supertest';
import { pool } from '../db';
import { createTestUser, createTestAlbum, authHeader } from '../../tests/setup';
import { sendPush } from '../services/apns';
const app = require('../app');
const mockSendPush = sendPush as jest.Mock;

async function createPhoto(albumId: string, userId: string) {
  const { rows } = await pool.query(
    `INSERT INTO photos (album_id, uploaded_by, r2_key, taken_at)
     VALUES ($1, $2, 'photos/test.webp', now())
     RETURNING id`,
    [albumId, userId]
  );
  return rows[0].id as string;
}

describe('GET /photos/:photoId/reactions', () => {
  it('returns empty array when no reactions', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(authHeader(user));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 403 for non-member', async () => {
    const owner = await createTestUser();
    const other = await createTestUser({ apple_sub: 'other' });
    const album = await createTestAlbum(owner.id);
    const photoId = await createPhoto(album.id, owner.id);

    const res = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(authHeader(other));

    expect(res.status).toBe(403);
  });
});

describe('POST /photos/:photoId/reactions', () => {
  it('adds a reaction and returns 201', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '❤️' });

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  it('upserts — second call with different emoji updates the reaction', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '❤️' });

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '😍' });

    const listRes = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(authHeader(user));

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toEqual({ emoji: '😍', count: 1 });
  });

  it('sends push to uploader when reactor is different user', async () => {
    const uploader = await createTestUser({ apns_token: 'tok-uploader' });
    const reactor = await createTestUser({ apple_sub: 'reactor-sub' });
    const album = await createTestAlbum(uploader.id);
    // Add reactor as member
    await pool.query(
      'INSERT INTO album_members (album_id, user_id) VALUES ($1, $2)',
      [album.id, reactor.id]
    );
    const photoId = await createPhoto(album.id, uploader.id);

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(reactor))
      .send({ emoji: '🥹' });

    expect(mockSendPush).toHaveBeenCalledWith(
      ['tok-uploader'],
      expect.stringContaining('react'),
      expect.stringContaining('🥹'),
      expect.objectContaining({ photoId })
    );
  });

  it('does not push when reactor is the uploader', async () => {
    const user = await createTestUser({ apns_token: 'tok-self' });
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '❤️' });

    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid emoji', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    const res = await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '💩' });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /photos/:photoId/reactions', () => {
  it('removes the reaction', async () => {
    const user = await createTestUser();
    const album = await createTestAlbum(user.id);
    const photoId = await createPhoto(album.id, user.id);

    await request(app)
      .post(`/photos/${photoId}/reactions`)
      .set(authHeader(user))
      .send({ emoji: '❤️' });

    const del = await request(app)
      .delete(`/photos/${photoId}/reactions`)
      .set(authHeader(user));

    expect(del.status).toBe(200);
    expect(del.body.ok).toBe(true);

    const list = await request(app)
      .get(`/photos/${photoId}/reactions`)
      .set(authHeader(user));

    expect(list.body).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy migration trên test DB, sau đó chạy tests**

```bash
cd backend && npm run migrate:push && npx jest src/routes/reactions.test.ts --no-coverage
```

Expected: tất cả pass

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/reactions.test.ts
git commit -m "test(backend): add reactions route tests"
```

---

### Task 4: Mobile — useReactions hook

**Files:**
- Create: `mobile/src/hooks/useReactions.ts`

- [ ] **Step 1: Tạo hook**

Tạo `mobile/src/hooks/useReactions.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReactionCount {
  emoji: string;
  count: number;
}

export function useReactions(photoId: string) {
  return useQuery<ReactionCount[]>({
    queryKey: ['reactions', photoId],
    queryFn: async () => {
      const { data } = await api.get(`/photos/${photoId}/reactions`);
      return data;
    },
    enabled: !!photoId,
  });
}

export function useReact(photoId: string) {
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: (emoji: string) =>
      api.post(`/photos/${photoId}/reactions`, { emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', photoId] }),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/photos/${photoId}/reactions`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', photoId] }),
  });

  return { add, remove };
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/hooks/useReactions.ts
git commit -m "feat(mobile): add useReactions hook"
```

---

### Task 5: Mobile — ReactionPicker component

**Files:**
- Create: `mobile/src/components/ui/ReactionPicker.tsx`

- [ ] **Step 1: Tạo component**

Tạo `mobile/src/components/ui/ReactionPicker.tsx`:

```tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, StyleSheet } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { tap } from '@/lib/haptics';

const EMOJIS = ['❤️', '😂', '😍', '🥹'] as const;
export type ReactionEmoji = (typeof EMOJIS)[number];

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: ReactionEmoji) => void;
  onDismiss: () => void;
}

export function ReactionPicker({ visible, onSelect, onDismiss }: ReactionPickerProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.picker}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.emojiBtn}
                  onPress={() => {
                    tap();
                    onSelect(emoji);
                  }}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(61,42,31,0.3)', alignItems: 'center', justifyContent: 'center' },
  picker:    { flexDirection: 'row', backgroundColor: colors.cream, borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm, borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  emojiBtn:  { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm },
  emoji:     { fontSize: 28 },
});
```

- [ ] **Step 2: Commit**

```bash
git add mobile/src/components/ui/ReactionPicker.tsx
git commit -m "feat(mobile): add ReactionPicker component"
```

---

### Task 6: Mobile — ReactionBadge + wire into PhotoCell

**Files:**
- Create: `mobile/src/components/ui/ReactionBadge.tsx`
- Modify: `mobile/src/components/ui/PhotoCell.tsx`

- [ ] **Step 1: Tạo ReactionBadge**

Tạo `mobile/src/components/ui/ReactionBadge.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';
import type { ReactionCount } from '@/hooks/useReactions';

interface ReactionBadgeProps {
  reactions: ReactionCount[];
}

export function ReactionBadge({ reactions }: ReactionBadgeProps) {
  if (!reactions.length) return null;

  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  const top2 = reactions.slice(0, 2).map((r) => r.emoji).join('');

  return (
    <View style={styles.badge}>
      <Text style={styles.emojis}>{top2}</Text>
      {total > 1 && <Text style={styles.count}>{total}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,251,240,0.92)', borderRadius: 10, paddingHorizontal: spacing.xs, paddingVertical: 2, gap: 2 },
  emojis: { fontSize: 11 },
  count:  { ...typography.caption, color: colors.ink, fontSize: 10 },
});
```

- [ ] **Step 2: Thay toàn bộ PhotoCell bằng version mới**

Thay toàn bộ nội dung `mobile/src/components/ui/PhotoCell.tsx`:

```tsx
import React, { useRef, useState } from 'react';
import { TouchableOpacity, Image, Text, View, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { colors, radii, shadows, typography, spacing } from '@/constants/theme';
import { tap } from '@/lib/haptics';
import { ReactionPicker, type ReactionEmoji } from './ReactionPicker';
import { ReactionBadge } from './ReactionBadge';
import { useReactions, useReact } from '@/hooks/useReactions';

interface PhotoCellProps {
  uri: string;
  caption?: string | null;
  size: number;
  index?: number;
  photoId?: string;
  onPress?: () => void;
  style?: ViewStyle;
  showReactions?: boolean;
}

export function PhotoCell({ uri, caption, size, index = 0, photoId, onPress, style, showReactions }: PhotoCellProps) {
  const ref = useRef<View>(null);
  const useAlt = index % 2 === 1;
  const [tl, tr, br, bl] = useAlt ? radii.stickerAlt : radii.sticker;
  const [pickerVisible, setPickerVisible] = useState(false);

  const { data: reactionData = [] } = useReactions(photoId ?? '');
  const { add } = useReact(photoId ?? '');

  function handlePress() {
    tap();
    if (photoId) {
      ref.current?.measureInWindow((x, y, w, h) => {
        router.push({ pathname: `/photo/${photoId}`, params: { srcX: x, srcY: y, srcW: w, srcH: h } });
      });
      return;
    }
    onPress?.();
  }

  function handleLongPress() {
    if (!photoId || !showReactions) return;
    tap();
    setPickerVisible(true);
  }

  function handleSelectEmoji(emoji: ReactionEmoji) {
    setPickerVisible(false);
    add.mutate(emoji);
  }

  return (
    <View>
      <TouchableOpacity
        ref={ref as any}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        style={[
          { width: size, height: size,
            borderTopLeftRadius: tl, borderTopRightRadius: tr,
            borderBottomRightRadius: br, borderBottomLeftRadius: bl },
          styles.container,
          style,
        ]}
        activeOpacity={0.9}
      >
        <Image source={{ uri }} style={styles.image} resizeMode="cover" />
        {showReactions && reactionData.length > 0 && (
          <View style={styles.reactionOverlay}>
            <ReactionBadge reactions={reactionData} />
          </View>
        )}
      </TouchableOpacity>
      {caption && (
        <Text style={styles.caption} numberOfLines={1}>{caption}</Text>
      )}
      {showReactions && photoId && (
        <ReactionPicker
          visible={pickerVisible}
          onSelect={handleSelectEmoji}
          onDismiss={() => setPickerVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { backgroundColor: colors.white, borderWidth: 3, borderColor: colors.white, overflow: 'hidden', ...shadows.sticker },
  image:           { width: '100%', height: '100%' },
  caption:         { ...typography.handAccent, color: colors.inkSoft, fontSize: 14, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
  reactionOverlay: { position: 'absolute', bottom: spacing.xs, right: spacing.xs },
});
```

- [ ] **Step 3: Update PhotoRow để pass showReactions prop**

Mở `mobile/src/components/timeline/PhotoRow.tsx`. Thay `<PhotoCell` dengan tambah prop:

```tsx
        <PhotoCell
          key={p.id}
          uri={`${API_URL}/photos/${p.id}/thumb`}
          caption={p.caption}
          size={cellSize}
          index={rowIndex * 2 + i}
          photoId={p.id}
          showReactions
        />
```

- [ ] **Step 4: Chạy TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/ReactionBadge.tsx mobile/src/components/ui/PhotoCell.tsx mobile/src/components/timeline/PhotoRow.tsx
git commit -m "feat(mobile): add reaction badge and long-press picker to PhotoCell"
```

---

## PART B — STORAGE FREEDOM

---

### Task 7: Mobile — Install expo-media-library

**Files:**
- Modify: `mobile/package.json` (via npx expo install)

- [ ] **Step 1: Install**

```bash
cd mobile && npx expo install expo-media-library
```

Expected: package added to package.json và package-lock.json

- [ ] **Step 2: Thêm permission vào app.json**

Mở `mobile/app.json` (hoặc `app.config.js`), tìm phần `ios.infoPlist` và thêm:

```json
"NSPhotoLibraryUsageDescription": "Dùng để xoá ảnh đã lưu lên app khỏi bộ nhớ điện thoại",
"NSPhotoLibraryAddUsageDescription": "Dùng để xoá ảnh đã lưu lên app khỏi bộ nhớ điện thoại"
```

- [ ] **Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json
git commit -m "chore(mobile): install expo-media-library for storage freedom"
```

---

### Task 8: Mobile — uploadStore + track synced photos

**Files:**
- Create: `mobile/src/stores/uploadStore.ts`
- Modify: `mobile/src/hooks/useUpload.ts`

- [ ] **Step 1: Tạo uploadStore**

Tạo `mobile/src/stores/uploadStore.ts`:

```ts
import { create } from 'zustand';

export interface SyncedPhoto {
  localAssetId: string;
  compressedBytes: number;
}

interface UploadStore {
  syncedPhotos: SyncedPhoto[];
  addSynced: (photo: SyncedPhoto) => void;
  removeSynced: (localAssetIds: string[]) => void;
  clearAll: () => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  syncedPhotos: [],
  addSynced: (photo) =>
    set((s) => ({
      syncedPhotos: s.syncedPhotos.some((p) => p.localAssetId === photo.localAssetId)
        ? s.syncedPhotos
        : [...s.syncedPhotos, photo],
    })),
  removeSynced: (ids) =>
    set((s) => ({
      syncedPhotos: s.syncedPhotos.filter((p) => !ids.includes(p.localAssetId)),
    })),
  clearAll: () => set({ syncedPhotos: [] }),
}));
```

- [ ] **Step 2: Update useUpload để track synced photos**

Mở `mobile/src/hooks/useUpload.ts`.

Thêm import ở đầu:

```ts
import { useUploadStore } from '@/stores/uploadStore';
```

Bên trong `useUpload()`, thêm sau `const albumId = ...`:

```ts
  const addSynced = useUploadStore((s) => s.addSynced);
```

Trong vòng lặp `for (let i = 0; ...)` trong `uploadImages`, sau bước "4. Register" thêm:

```ts
        // Track for storage freedom badge
        if (asset.localAssetId) {
          addSynced({ localAssetId: asset.localAssetId, compressedBytes: blob.size });
        }
```

- [ ] **Step 3: Chạy TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add mobile/src/stores/uploadStore.ts mobile/src/hooks/useUpload.ts
git commit -m "feat(mobile): track synced photos in uploadStore for storage freedom"
```

---

### Task 9: Mobile — StorageBadge + StorageFreedomModal

**Files:**
- Create: `mobile/src/components/ui/StorageBadge.tsx`
- Create: `mobile/src/components/ui/StorageFreedomModal.tsx`
- Modify: `mobile/src/locales/vi.ts`
- Modify: `mobile/src/locales/en.ts`

- [ ] **Step 1: Thêm i18n keys**

Thêm section `storage` vào `mobile/src/locales/vi.ts` (trong object `vi`, trước dấu `}` cuối):

```ts
  storage: {
    badge:         '{{count}} ảnh đã lưu an toàn — Giải phóng {{size}}',
    modal_title:   'Xoá ảnh khỏi điện thoại',
    modal_body:    'Những ảnh này đã được lưu an toàn trên app. Bạn có muốn xoá khỏi điện thoại để giải phóng bộ nhớ không?',
    delete_btn:    'Xoá {{count}} ảnh',
    cancel:        'Để sau',
    success_toast: 'Đã giải phóng {{size}} trên điện thoại của bạn',
    perm_title:    'Cần quyền truy cập ảnh',
    perm_body:     'App cần quyền để xoá ảnh khỏi thư viện của bạn.',
  },
```

Thêm tương tự vào `mobile/src/locales/en.ts`:

```ts
  storage: {
    badge:         '{{count}} photos saved safely — Free up {{size}}',
    modal_title:   'Delete photos from phone',
    modal_body:    'These photos are safely saved in the app. Delete them from your phone to free up storage?',
    delete_btn:    'Delete {{count}} photos',
    cancel:        'Later',
    success_toast: 'Freed {{size}} on your phone',
    perm_title:    'Photo library access needed',
    perm_body:     'App needs permission to delete photos from your library.',
  },
```

- [ ] **Step 2: Tạo StorageBadge**

Tạo `mobile/src/components/ui/StorageBadge.tsx`:

```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography, shadows } from '@/constants/theme';
import { useUploadStore } from '@/stores/uploadStore';
import { t } from '@/lib/i18n';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface StorageBadgeProps {
  onPress: () => void;
}

export function StorageBadge({ onPress }: StorageBadgeProps) {
  const syncedPhotos = useUploadStore((s) => s.syncedPhotos);
  if (!syncedPhotos.length) return null;

  const totalBytes = syncedPhotos.reduce((sum, p) => sum + p.compressedBytes, 0);
  const label = t('storage.badge', { count: syncedPhotos.length, size: formatSize(totalBytes) });

  return (
    <TouchableOpacity style={styles.badge} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.text}>💾 {label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    marginHorizontal: spacing['2xl'],
    marginTop: spacing.sm,
    backgroundColor: colors.mint,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    ...shadows.sticker,
  },
  text: { ...typography.bodySmall, color: colors.ink, textAlign: 'center' },
});
```

- [ ] **Step 3: Tạo StorageFreedomModal**

Tạo `mobile/src/components/ui/StorageFreedomModal.tsx`:

```tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { colors, radii, spacing, typography, shadows } from '@/constants/theme';
import { useUploadStore } from '@/stores/uploadStore';
import { t } from '@/lib/i18n';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

interface StorageFreedomModalProps {
  visible: boolean;
  onClose: () => void;
  onFreed: (message: string) => void;
}

export function StorageFreedomModal({ visible, onClose, onFreed }: StorageFreedomModalProps) {
  const { syncedPhotos, removeSynced } = useUploadStore();
  const [deleting, setDeleting] = useState(false);

  const totalBytes = syncedPhotos.reduce((sum, p) => sum + p.compressedBytes, 0);

  async function handleDelete() {
    setDeleting(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('storage.perm_title'), t('storage.perm_body'));
        setDeleting(false);
        return;
      }

      const ids = syncedPhotos.map((p) => p.localAssetId);
      await MediaLibrary.deleteAssetsAsync(ids);
      removeSynced(ids);
      onClose();
      onFreed(t('storage.success_toast', { size: formatSize(totalBytes) }));
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể xoá ảnh. Thử lại sau.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{t('storage.modal_title')}</Text>
          <Text style={styles.body}>{t('storage.modal_body')}</Text>
          <Text style={styles.size}>{formatSize(totalBytes)} • {syncedPhotos.length} ảnh</Text>
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && { opacity: 0.5 }]}
            onPress={handleDelete}
            disabled={deleting}
          >
            <Text style={styles.deleteBtnText}>
              {deleting ? 'Đang xoá...' : t('storage.delete_btn', { count: syncedPhotos.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('storage.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { flex: 1, backgroundColor: 'rgba(61,42,31,0.4)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: colors.cream, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing['3xl'], borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  title:         { ...typography.heading, marginBottom: spacing.sm },
  body:          { ...typography.body, color: colors.inkSoft, marginBottom: spacing.md },
  size:          { ...typography.bodySmall, color: colors.inkMuted, marginBottom: spacing['3xl'] },
  deleteBtn:     { backgroundColor: colors.peach, borderRadius: radii.md, borderWidth: 2, borderColor: colors.ink, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, ...shadows.sticker },
  deleteBtnText: { ...typography.title, color: colors.ink },
  cancelBtn:     { alignItems: 'center', padding: spacing.md },
  cancelText:    { ...typography.body, color: colors.inkMuted },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/ui/StorageBadge.tsx mobile/src/components/ui/StorageFreedomModal.tsx mobile/src/locales/vi.ts mobile/src/locales/en.ts
git commit -m "feat(mobile): add StorageBadge and StorageFreedomModal components"
```

---

### Task 10: Mobile — Wire StorageBadge vào Home screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Thêm imports và state**

Mở `mobile/app/(tabs)/index.tsx`, thêm imports:

```ts
import { useState } from 'react';
import { Alert } from 'react-native';
import { StorageBadge } from '@/components/ui/StorageBadge';
import { StorageFreedomModal } from '@/components/ui/StorageFreedomModal';
```

Bên trong `HomeScreen()`, thêm state:

```ts
  const [storageModalVisible, setStorageModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
```

- [ ] **Step 2: Thêm badge + modal vào render**

Trong `return (...)`, thêm `<StorageBadge>` sau `<JoyfulHeader>` và trước `<TimelineFeed>`:

```tsx
      <StorageBadge onPress={() => setStorageModalVisible(true)} />
      <TimelineFeed childBirthdate={birthdate} />
      <StorageFreedomModal
        visible={storageModalVisible}
        onClose={() => setStorageModalVisible(false)}
        onFreed={(msg) => {
          setStorageModalVisible(false);
          Alert.alert('✅', msg);
        }}
      />
```

- [ ] **Step 3: Chạy TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Chạy tất cả mobile tests**

```bash
cd mobile && npx jest --no-coverage
```

Expected: tất cả pass (tests hiện tại không cover storage logic nên không break)

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): wire StorageBadge and StorageFreedomModal into home screen"
```

---

### Task 11: Chạy toàn bộ test suite

- [ ] **Step 1: Backend tests**

```bash
cd backend && npm test -- --no-coverage
```

Expected: tất cả pass

- [ ] **Step 2: Mobile tests**

```bash
cd mobile && npx jest --no-coverage
```

Expected: tất cả pass

- [ ] **Step 3: Final commit nếu có gì còn sót**

```bash
git add -A
git status
# Chỉ commit nếu có file chưa staged
```
