# Sticker World — Browse Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Sticker World direction to the photo-browsing surfaces — Day grid (album detail), Story viewer, Photo detail, and Manage day. These are the screens where families actually look at their memories, so the visual identity matters most here.

**Architecture:**
- The Day grid header + cells get the sticker treatment via existing components (`StickerCard`, `StickerChip`, `StickerButton`, `Mascot`).
- `DayCell` becomes a `StickerCard` with the date label moved below the thumb (visual restructure per spec).
- The Story viewer keeps its complex video / progress / gesture logic intact; only the chrome (top bar, progress bar, date chip, caption card, reactions, menu) is restyled with sticker components and `theme.overlays.*` tokens.
- Photo detail and Manage day each get a focused rewrite of their visual layer; behaviors (timeline navigation, caption editing, delete confirmation) are preserved.
- Each migrated file joins `THEME_CLEAN_APP_FILES` so the hex-literal guard locks it.

**Tech Stack:** Expo 56, expo-router, expo-video, expo-image, react-native-reanimated, react-native-gesture-handler, Jest + jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` — sections "Album / Day Grid" (line 600), "Story Viewer" (line 608), "Photo Detail" (line 617), "Manage Day" (line 626).

**Depends on:** Plans 1-3 landed (foundation, capture flow, onboarding+sign-in). `theme.overlays.*` and the sticker components are available.

---

## File Structure

```
mobile/
├── src/
│   ├── components/
│   │   └── album/
│   │       └── DayCell.tsx                       ← REWRITTEN (Task 1)
│   └── __tests__/
│       └── hex-literal-guard.test.ts             ← MODIFIED (Tasks 1, 2, 3, 4 — extend THEME_CLEAN_FILES / THEME_CLEAN_APP_FILES)
└── app/
    ├── albums/[id].tsx                           ← REWRITTEN (Task 1)
    ├── photo/[id].tsx                            ← REWRITTEN (Task 3)
    └── story/[albumId]/
        ├── [date].tsx                            ← REWRITTEN (Task 2)
        ├── [date]/manage.tsx                     ← REWRITTEN (Task 4)
        └── _components/
            └── VlogOverlay.tsx                   ← MODIFIED (Task 2 — drop inline rgba, restyle dots via theme)
```

---

## Task 1: Day grid + DayCell migration

The day grid header gets sticker icons; rows become `<StickerCard>` cells with the date label below the thumb (visual restructure); the empty state gets a Mascot + caption + hint; the rename modal upgrades to `StickerCard` + `StickerButton`; the archived banner becomes a `StickerChip variant="ink"`.

**Spec reference:** lines 600-606.

**Files:**
- Rewrite: `mobile/src/components/album/DayCell.tsx`
- Rewrite: `mobile/app/albums/[id].tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 1.1: Rewrite `DayCell.tsx`

Replace the entire contents of `mobile/src/components/album/DayCell.tsx` with:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Images } from 'phosphor-react-native';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { theme, spacing, typography } from '@/constants/theme';

interface Props {
  date: string;
  thumbnailUrl: string | null;
  hasVideo: boolean;
  tall: boolean;
  index: number;
  onPress: () => void;
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']; // Vietnamese short weekdays, Sunday=0

export function DayCell({ date, thumbnailUrl, hasVideo, tall, index, onPress }: Props) {
  const { width } = useWindowDimensions();
  const colWidth = (width - spacing['2xl'] * 2 - spacing.sm) / 2;
  const thumbHeight = tall ? colWidth * 1.2 : colWidth * 0.75;

  const parts = date.split('-'); // ['YYYY', 'MM', 'DD']
  const dayNum = parts[2];
  const monthNum = parts[1];
  const weekday = WEEKDAYS[new Date(date).getDay()] ?? '';
  const label = `${weekday} · ${dayNum}.${monthNum}`;

  return (
    <TouchableOpacity
      testID={`day-cell-${date}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={{ width: colWidth }}
    >
      <StickerCard tilt="default" flip={index % 2 === 1} style={styles.card}>
        <View style={[styles.thumbWrap, { height: thumbHeight }]}>
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
              <Images size={28} color={theme.colors.textMuted} />
            </View>
          )}
          {hasVideo && (
            <View style={styles.videoBadge} testID="video-badge">
              <StickerChip label="▶" variant="ink" />
            </View>
          )}
        </View>
        <Text style={styles.dateLabel}>{label}</Text>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card:        { padding: spacing.xs, overflow: 'hidden' },
  thumbWrap:   {
    width: '100%',
    borderWidth: theme.border.thin,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.borderSoft,
    overflow: 'hidden',
  },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  videoBadge:  { position: 'absolute', top: spacing.xs, right: spacing.xs },
  dateLabel:   { ...typography.displayCute, fontSize: 13, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xs },
});
```

**Notes:**
- The `index` prop is new — required for the alternating `flip` behavior. Callers in `albums/[id].tsx` will pass it from `FlatList` index.
- The date label now lives below the thumb in `displayCute` typography ("T5 · 11.06") instead of overlaying the thumb. This is the spec's visual restructure.
- The placeholder uses `theme.colors.textMuted` for the icon.
- The video badge is a small `<StickerChip variant="ink" label="▶" />` in the top-right corner.

### Step 1.2: Rewrite `app/albums/[id].tsx`

Replace the entire contents of `mobile/app/albums/[id].tsx` with:

```tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, DotsThree, Archive } from 'phosphor-react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { DayCell } from '@/components/album/DayCell';
import { useAlbumDays, AlbumDay } from '@/hooks/useAlbumDays';
import { useAlbumStore } from '@/stores/albumStore';
import { AlbumMenuSheet } from '@/components/family/AlbumMenuSheet';
import { InviteSheet } from '@/components/family/InviteSheet';
import { MembersSheet } from '@/components/family/MembersSheet';
import { api } from '@/lib/api';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const albumId    = useAlbumStore((s) => s.albumId);
  const albumName  = useAlbumStore((s) => s.albumName);
  const archivedAt = useAlbumStore((s) => s.archivedAt);
  const setAlbumName  = useAlbumStore((s) => s.setAlbumName);
  const setArchivedAt = useAlbumStore((s) => s.setArchivedAt);
  const { data: days, isLoading } = useAlbumDays(albumId ?? null);
  const qc = useQueryClient();

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [inviteOpen,  setInviteOpen]  = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [renameOpen,  setRenameOpen]  = useState(false);
  const [renameText,  setRenameText]  = useState('');
  const [renaming,    setRenaming]    = useState(false);

  const isArchived = archivedAt !== null;

  const pairs: Array<[AlbumDay, AlbumDay | undefined]> = [];
  if (days) {
    for (let i = 0; i < days.length; i += 2) {
      pairs.push([days[i], days[i + 1]]);
    }
  }

  async function handleRenameConfirm() {
    const name = renameText.trim();
    if (!name || !albumId) return;
    setRenaming(true);
    try {
      await api.patch(`/albums/${albumId}`, { name });
      setAlbumName(name);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setRenameOpen(false);
    } catch {
      Alert.alert(t('common.error'), t('albums.rename_error'));
    } finally {
      setRenaming(false);
    }
  }

  function handleArchivePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.archive'),
      t('album_menu.archive_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.archive'),
          onPress: async () => {
            try {
              const { data } = await api.post(`/albums/${albumId}/archive`);
              setArchivedAt(data.archived_at);
              await qc.invalidateQueries({ queryKey: ['albums'] });
            } catch {
              Alert.alert(t('common.error'), t('albums.archive_error'));
            }
          },
        },
      ]
    );
  }

  function handleDeletePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.delete_album'),
      t('album_menu.delete_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.delete_album'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), t('albums.delete_error'));
            }
          },
        },
      ]
    );
  }

  function handleLeavePress() {
    setMenuOpen(false);
    Alert.alert(
      t('album_menu.leave_album'),
      t('album_menu.leave_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('album_menu.leave_album'),
          onPress: async () => {
            try {
              await api.delete(`/albums/${albumId}/members/me`);
              await qc.invalidateQueries({ queryKey: ['albums'] });
              router.back();
            } catch {
              Alert.alert(t('common.error'), t('albums.leave_error'));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={renameOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <StickerCard shadow="heavy" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('album_menu.rename_title')}</Text>
            <TextInput
              style={styles.input}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRenameConfirm} disabled={renaming} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{renaming ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </StickerCard>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{albumName ?? ''}</Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <DotsThree size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
      </View>

      {isArchived && (
        <View style={styles.archivedWrap}>
          <StickerChip
            label={t('album_menu.archived_banner')}
            variant="ink"
            icon={<Archive size={12} color={theme.colors.accent1} />}
          />
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : !days || days.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Mascot size={80} tilt="default" />
          <Text style={styles.empty}>{t('albums.day_grid_empty')}</Text>
          <Text style={styles.emptySub}>{t('albums.day_grid_empty_hint')}</Text>
        </View>
      ) : (
        <FlatList
          data={pairs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.grid}
          renderItem={({ item: [left, right], index }) => (
            <View style={styles.row}>
              <DayCell
                date={left.date}
                thumbnailUrl={left.thumb_url}
                hasVideo={left.has_video}
                tall={index % 2 === 0}
                index={index * 2}
                onPress={() => router.push(`/story/${albumId}/${left.date}`)}
              />
              {right && (
                <DayCell
                  date={right.date}
                  thumbnailUrl={right.thumb_url}
                  hasVideo={right.has_video}
                  tall={index % 2 !== 0}
                  index={index * 2 + 1}
                  onPress={() => router.push(`/story/${albumId}/${right.date}`)}
                />
              )}
            </View>
          )}
        />
      )}

      <AlbumMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenMembers={() => { setMenuOpen(false); setMembersOpen(true); }}
        onOpenInvite={() =>  { setMenuOpen(false); setInviteOpen(true); }}
        onRename={() => {
          setMenuOpen(false);
          setRenameText(albumName ?? '');
          setRenameOpen(true);
        }}
        onArchive={handleArchivePress}
        onDelete={handleDeletePress}
        onLeave={handleLeavePress}
      />
      <InviteSheet  visible={inviteOpen}  onClose={() => setInviteOpen(false)} />
      <MembersSheet visible={membersOpen} onClose={() => setMembersOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: theme.colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:         { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', padding: 0 },
  title:           { ...typography.title, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  archivedWrap:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, alignItems: 'flex-start' },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['3xl'] },
  empty:           { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', fontFamily: theme.fonts.semiBold },
  emptySub:        { ...typography.caption, color: theme.colors.textMuted, textAlign: 'center' },
  grid:            { padding: spacing['2xl'], gap: spacing.md },
  row:             { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  modalOverlay:    { flex: 1, backgroundColor: theme.overlays.scrim, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['2xl'] },
  modalCard:       { width: '100%', padding: spacing['2xl'], gap: spacing.lg },
  modalTitle:      { ...typography.title, color: theme.colors.textPrimary },
  input:           { ...typography.body, color: theme.colors.textPrimary, borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.borderSoft, paddingVertical: spacing.sm },
  modalActions:    { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalBtn:        { padding: spacing.sm },
  modalBtnCancel:  { ...typography.body, color: theme.colors.textMuted },
  modalBtnConfirm: { ...typography.body, color: theme.colors.primary },
});
```

### Step 1.3: Add new i18n strings

Existing strings used by this file: `common.error`, `common.cancel`, `common.done`, `album_menu.*`. The rewrite adds 4 new keys to the `albums` block plus 2 to `albums` for empty-state copy:

- [ ] In `mobile/src/locales/vi.ts`, extend the existing `albums` block:

```ts
  albums: {
    // existing keys...
    day_grid_empty:       'Chưa có khoảnh khắc nào',
    day_grid_empty_hint:  'Vuốt sang tab Camera để chụp ảnh đầu tiên',
    rename_error:         'Không thể đổi tên album.',
    archive_error:        'Không thể lưu trữ album.',
    delete_error:         'Không thể xóa album.',
    leave_error:          'Không thể rời album.',
  },
```

- [ ] Add matching English keys to `mobile/src/locales/en.ts`: `day_grid_empty: 'No moments yet'`, `day_grid_empty_hint: 'Swipe to the Camera tab to take your first photo'`, plus the 4 error messages (`Cannot rename album.`, `Cannot archive album.`, `Cannot delete album.`, `Cannot leave album.`).

### Step 1.4: Add to theme-clean files

Update `THEME_CLEAN_FILES` and `THEME_CLEAN_APP_FILES` in `mobile/src/__tests__/hex-literal-guard.test.ts`:

```ts
const THEME_CLEAN_FILES = [
  // ...existing...
  'src/components/album/DayCell.tsx',
];

const THEME_CLEAN_APP_FILES = [
  // ...existing...
  'app/albums/[id].tsx',
];
```

### Step 1.5: Verify

- [ ] `cd mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (12 specs).
- [ ] `cd mobile && npx tsc --noEmit` — clean (TS5101 OK).
- [ ] `cd mobile && npx jest --silent` — baseline.

### Step 1.6: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/album/DayCell.tsx mobile/app/albums/\[id\].tsx mobile/src/locales/vi.ts mobile/src/locales/en.ts mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(album): migrate Day grid + DayCell to Sticker World

DayCell rebuilt as a StickerCard with alternating tilt; the date
label moved below the thumb (displayCute typography); video badge is
now a StickerChip variant="ink". Album header buttons become butter
StickerCard icons; archived banner becomes StickerChip variant="ink".
Empty state uses Mascot + caption + hint. Rename modal switches to
StickerCard + theme.overlays.scrim. Six new i18n keys added in both
locales. Both files join the theme-clean lists.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Story viewer migration

The story viewer keeps its video player + gesture + progress logic intact; the visual layer (top bar, progress line, date chip, time chip, caption card, reaction button, menu dropdown) gets the sticker treatment.

**Spec reference:** lines 608-616.

**Files:**
- Rewrite: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/story/[albumId]/_components/VlogOverlay.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 2.1: Apply surgical edits to `app/story/[albumId]/[date].tsx`

This file has ~300 lines, most of which is video-player lifecycle and gesture handling that must NOT change. Apply only these visual edits:

**A) Update imports** — replace the existing `import { colors, fonts, spacing, typography } from '@/constants/theme';` with:

```ts
import { theme, spacing, typography } from '@/constants/theme';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
```

**B) The `topBar` rendering** — find the JSX block that starts with `<View style={[styles.topBar, ...]}>`. Replace it with:

```tsx
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} testID="story-back" hitSlop={8}>
            <StickerCard style={styles.topIconBtn}>
              <CaretLeftIcon size={16} color={theme.colors.textPrimary} weight="bold" />
            </StickerCard>
          </TouchableOpacity>
          <View style={styles.dateChipWrap}>
            <StickerChip
              label={dateChip}
              variant="yellow"
              tilt="default"
              flip
              testID="story-date-chip"
            />
          </View>
          <TouchableOpacity onPress={() => setMenuOpen(true)} testID="story-menu-btn" hitSlop={8}>
            <StickerCard style={styles.topIconBtn}>
              <DotsThree size={16} color={theme.colors.textPrimary} weight="bold" />
            </StickerCard>
          </TouchableOpacity>
        </View>
```

Add these imports if missing: `DotsThree` from `phosphor-react-native`. Remove the existing `menuDots` Text rendering (the `<Text style={styles.menuDots}>•••</Text>`).

**C) The menu dropdown** — find `{menuOpen && (` and replace the inner `<View style={styles.menuDropdown}>` with `<StickerCard shadow="heavy" style={styles.menuDropdown}>`. Inside the menu items, swap `colors.white` for `theme.colors.textPrimary` on the icons and labels, and `colors.error` for `theme.colors.error`. Update the `menuItemText` style to use `theme.colors.textPrimary`.

**D) The progress line** — replace the progress line styles. Find `progressLine` and `progressFill` in the StyleSheet. Update:

```ts
  progressLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 4,
    backgroundColor: theme.overlays.surfaceOnDark,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    zIndex: 20,
  },
  progressFill: { height: '100%' },
  progressFillPlaying: { backgroundColor: theme.colors.surface },
  progressFillPaused: { backgroundColor: theme.colors.accent1 },
```

**E) The styles block** — rewrite the entire `StyleSheet.create({...})` block at the bottom of the file. Replace it with:

```ts
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.overlays.cameraBg, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
  },
  topIconBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    padding: 0,
  },
  dateChipWrap: { flex: 1, alignItems: 'center' },

  tapAreas: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  tapLeft: { flex: 3 },
  tapCenter: { flex: 4 },
  tapRight: { flex: 3 },

  progressLine: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 4,
    backgroundColor: theme.overlays.surfaceOnDark,
    borderTopWidth: theme.border.thin,
    borderTopColor: theme.colors.border,
    zIndex: 20,
  },
  progressFill: { height: '100%' },
  progressFillPlaying: { backgroundColor: theme.colors.surface },
  progressFillPaused:  { backgroundColor: theme.colors.accent1 },

  menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
  menuDropdown: {
    position: 'absolute', top: 48, right: spacing.lg,
    minWidth: 160,
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: theme.border.hairline,
    borderBottomColor: theme.colors.borderSoft,
  },
  menuItemDanger: { borderBottomWidth: 0 },
  menuItemText: { ...typography.body, color: theme.colors.textPrimary, fontSize: 13 },
});
```

(The original file had a `circleBtn`, `dateChip`, and `menuDots` style — those are now obsolete since StickerCard/StickerChip handle their own styling.)

**F) Confirm no stray inline rgba/hex** — grep:

```
grep -E '#[0-9a-fA-F]{3,8}|rgba?\s*\(' mobile/app/story/\[albumId\]/\[date\].tsx
```

Expected: no matches. If any remain (e.g., in the `<VideoView style={...}>` or somewhere inside the menu), replace them.

### Step 2.2: Update `VlogOverlay.tsx`

Replace the entire contents of `mobile/app/story/[albumId]/_components/VlogOverlay.tsx` with:

```tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { theme, spacing } from '@/constants/theme';
import { MediaCaption } from '@/components/ui/MediaCaption';

export function VlogOverlay({
  photo,
  currentIndex,
  total,
  bottomInset = 0,
  isPaused = false,
}: {
  photo: DayPhoto;
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const caption = photo.caption?.trim() ?? '';

  const [displayedCaption, setDisplayedCaption] = useState('');

  useEffect(() => {
    if (!caption) return;
    let capInterval: ReturnType<typeof setInterval>;
    const words = caption.split(' ');
    const capAvailableMs = 1000;
    const capIntervalMs = Math.max(10, Math.floor(capAvailableMs / words.length));
    let wordIdx = 0;
    capInterval = setInterval(() => {
      wordIdx++;
      setDisplayedCaption(words.slice(0, wordIdx).join(' '));
      if (wordIdx >= words.length) clearInterval(capInterval);
    }, capIntervalMs);
    return () => clearInterval(capInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <MediaCaption
        time={timeStr}
        caption={displayedCaption || undefined}
        showPlayIcon
        isPaused={isPaused}
      />

      <LinearGradient
        colors={['transparent', theme.overlays.scrimSoft, theme.overlays.scrimDeep]}
        style={[styles.container, { paddingBottom: spacing.xl + bottomInset }]}
        pointerEvents="none"
      >
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              testID={i === currentIndex ? 'story-dot-active' : 'story-dot'}
              style={[styles.dot, i === currentIndex && styles.dotActive]}
            />
          ))}
        </View>
      </LinearGradient>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    zIndex: 10,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.overlays.surfaceOnDark,
  },
  dotActive: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.surface,
  },
});
```

### Step 2.3: Add both files to theme-clean lists

Update `THEME_CLEAN_APP_FILES`:

```ts
const THEME_CLEAN_APP_FILES = [
  // ...existing...
  'app/story/[albumId]/[date].tsx',
  'app/story/[albumId]/_components/VlogOverlay.tsx',
];
```

### Step 2.4: Verify and run existing story tests

- [ ] `cd mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (now 14 specs).
- [ ] `cd mobile && npx jest app/__tests__/story-screen.test.tsx app/__tests__/story-vlog-overlay.test.tsx` — these are in the pre-existing failure list. Confirm the failures are unchanged (likely expo-video listener shape, unrelated). If a NEW assertion failure appears (e.g. asserting on removed `circleBtn` style or `menuDots` Text), update minimally.
- [ ] `cd mobile && npx tsc --noEmit` — clean.
- [ ] `cd mobile && npx jest --silent` — baseline.

### Step 2.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/story/\[albumId\]/\[date\].tsx mobile/app/story/\[albumId\]/_components/VlogOverlay.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(story): migrate Story viewer to Sticker World chrome

Top-bar back/menu buttons become butter StickerCard icons; the date
chip is now a yellow StickerChip with playful tilt. Progress line
thickens to 4px with an ink top border; active fill is surface,
paused fill is accent1. Menu dropdown becomes a StickerCard.
VlogOverlay's gradient and dots read from theme.overlays.*. Both
files join THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Photo detail migration

The single-photo viewer (used when tapping a photo from the timeline) gets sticker chrome — close button + date chip + caption card.

**Spec reference:** lines 617-624. Note: the current implementation is a minimal full-screen photo viewer (BlurView top bar, no reaction row). The spec describes adding a reaction row; for this task, scope is limited to the existing surface — the reaction-row UI work is a follow-up.

**Files:**
- Rewrite: `mobile/app/photo/[id].tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 3.1: Rewrite `app/photo/[id].tsx`

Replace the entire contents with:

```tsx
import React from 'react';
import { View, StyleSheet, TouchableOpacity, useWindowDimensions, StatusBar, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'phosphor-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTimeline } from '@/hooks/useTimeline';
import { useSharedTransition } from '@/lib/sharedElement';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate } from '@/lib/format';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

export default function PhotoViewer() {
  const params = useLocalSearchParams<{ id: string; srcX?: string; srcY?: string; srcW?: string; srcH?: string }>();
  const { data } = useTimeline();
  const photos = (data?.pages.flatMap((p) => p.items) ?? []).filter((i: any) => i.type === 'photo');
  const idx    = photos.findIndex((p: any) => p.id === params.id);
  const photo  = photos[idx];
  const { width, height } = useWindowDimensions();

  const source = (params.srcX && params.srcY && params.srcW && params.srcH) ? {
    x: Number(params.srcX), y: Number(params.srcY), width: Number(params.srcW), height: Number(params.srcH),
  } : null;
  const style = useSharedTransition(source, width, height, true);

  const isVideo = (photo as any)?.media_type === 'video';
  const videoUri = isVideo ? ((photo as any)?.photo_url ?? '') : '';
  const player = useVideoPlayer(videoUri, (p) => {
    p.loop = true;
  });

  React.useEffect(() => {
    if (isVideo && player) player.play();
  }, [isVideo]);

  if (!photo) return null;
  const taken = (photo as any).taken_at as string;
  const counter = t('photo.counter', { i: idx + 1, n: photos.length });
  const dateLabel = formatVnDate(new Date(taken));

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {isVideo
        ? (
          <Animated.View style={[style]}>
            <VideoView
              player={player}
              style={{ flex: 1 }}
              contentFit="contain"
              nativeControls={false}
            />
          </Animated.View>
        )
        : <Animated.Image source={{ uri: (photo as any).photo_url }} style={[style]} resizeMode="contain" />
      }

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <X size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <View style={styles.chipWrap}>
          <StickerChip label={`${counter} · ${dateLabel}`} variant="yellow" tilt="default" flip />
        </View>
        <View style={styles.iconBtn} />
      </View>

      {(photo as any).caption && (
        <View style={styles.captionWrap}>
          <StickerCard tilt="subtle" flip style={styles.captionCard}>
            <Text style={styles.captionText}>{(photo as any).caption}</Text>
          </StickerCard>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: theme.overlays.cameraBg },
  topBar:      {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  iconBtn:     { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  chipWrap:    { flex: 1, alignItems: 'center' },
  captionWrap: { position: 'absolute', bottom: 60, left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  captionCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  captionText: { ...typography.body, color: theme.colors.textPrimary, textAlign: 'center' },
});
```

**Notes:**
- The previous `BlurView` top bar is dropped — the sticker icons read fine against the dark photo background, no blur needed.
- The caption moves from being floating text with a text-shadow into a `StickerCard` (matches the spec's caption-as-card direction).
- Background uses `theme.overlays.cameraBg` (`#000000` — slightly darker than the previous `#1A1A1A`; acceptable for a photo viewer).

### Step 3.2: Add to theme-clean files

```ts
const THEME_CLEAN_APP_FILES = [
  // ...existing...
  'app/photo/[id].tsx',
];
```

### Step 3.3: Verify

- [ ] `cd mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (now 15 specs).
- [ ] `cd mobile && npx jest app/photo/__tests__/\[id\].test.tsx` — run it; if pre-existing, confirm same baseline; if new failure on `.iconBtn` style or `BlurView`, update minimally.
- [ ] `cd mobile && npx tsc --noEmit` — clean.
- [ ] `cd mobile && npx jest --silent` — baseline.

### Step 3.4: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/photo/\[id\].tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(photo-viewer): migrate single-photo screen to Sticker World

Replaces the BlurView top bar with a butter StickerCard close button +
yellow StickerChip counter/date. Caption moves into a tilted
StickerCard. Background uses theme.overlays.cameraBg. The reaction
row described in the spec is deferred (current screen has no
reactions surface yet). app/photo/[id].tsx joins
THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Manage day migration

The day-management screen (caption editing, photo deletion) gets sticker treatment for the header, photo cards, delete overlay, and caption input.

**Spec reference:** lines 626-631.

**Files:**
- Rewrite: `mobile/app/story/[albumId]/[date]/manage.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 4.1: Rewrite `app/story/[albumId]/[date]/manage.tsx`

Replace the entire contents with:

```tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CaretLeftIcon, TrashIcon, PencilSimpleIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDayPhotos, DayPhoto } from '@/hooks/useDayPhotos';
import { useDeletePhoto, useUpdateCaption } from '@/hooks/usePhotoActions';
import { useAuthStore } from '@/stores/authStore';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

const IMAGE_HEIGHT = Math.round((Dimensions.get('window').width - spacing.lg * 2) * 0.75);

export default function ManageScreen() {
  const { albumId, date } = useLocalSearchParams<{ albumId: string; date: string }>();
  const insets = useSafeAreaInsets();
  const { data: serverPhotos } = useDayPhotos(albumId ?? null, date ?? null);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const deletePhoto = useDeletePhoto(albumId!, date!);
  const updateCaption = useUpdateCaption(albumId!, date!);

  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const photos = (serverPhotos ?? []).filter((p) => !deletedIds.has(p.id));

  const parts = (date ?? '').split('-');
  const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : (date ?? '');

  function getCaptionValue(photo: DayPhoto): string {
    return photo.id in captions ? captions[photo.id] : (photo.caption ?? '');
  }

  async function handleCaptionBlur(photo: DayPhoto) {
    const newVal = getCaptionValue(photo);
    if (newVal === (photo.caption ?? '')) return;
    const captionToSave = newVal.trim() === '' ? null : newVal.trim();
    setSavingIds((prev) => new Set([...prev, photo.id]));
    try {
      await updateCaption.mutateAsync({ photoId: photo.id, caption: captionToSave });
    } catch {
      Alert.alert('', t('manage.save_error'));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(photo.id);
        return next;
      });
    }
  }

  function handleDelete(photo: DayPhoto, remainingCount: number) {
    Alert.alert(
      t('manage.delete_confirm_title'),
      t('manage.delete_confirm_body'),
      [
        { text: t('manage.cancel'), style: 'cancel' },
        {
          text: t('manage.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletedIds((prev) => new Set([...prev, photo.id]));
            try {
              await deletePhoto.mutateAsync(photo.id);
              if (remainingCount === 1) router.back();
            } catch {
              setDeletedIds((prev) => {
                const next = new Set(prev);
                next.delete(photo.id);
                return next;
              });
              Alert.alert('', t('manage.delete_error'));
            }
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeftIcon size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{t('manage.title', { date: dateLabel })}</Text>
          {photos.length > 0 && (
            <Text style={styles.photoCount}>{photos.length} ảnh</Text>
          )}
        </View>
        <View style={styles.iconBtn} />
      </View>

      <FlatList
        data={photos}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: photo, index }) => {
          const isOwner = photo.uploaded_by === currentUserId;
          const isSaving = savingIds.has(photo.id);
          return (
            <StickerCard
              tilt="subtle"
              flip={index % 2 === 1}
              style={styles.card}
              testID={`manage-item-${photo.id}`}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: photo.thumb_url ?? undefined }}
                  style={styles.image}
                  resizeMode="cover"
                />
                {isOwner && (
                  <TouchableOpacity
                    testID={`delete-${photo.id}`}
                    onPress={() => handleDelete(photo, photos.length)}
                    hitSlop={8}
                    style={styles.deleteOverlay}
                  >
                    <StickerCard style={styles.deleteBtn}>
                      <TrashIcon size={16} color={theme.colors.textPrimary} weight="bold" />
                    </StickerCard>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.captionSection}>
                <View style={styles.pencilWrapper}>
                  <PencilSimpleIcon size={14} color={theme.colors.textMuted} />
                </View>
                {isOwner ? (
                  <TextInput
                    testID={`note-input-${photo.id}`}
                    style={styles.noteInput}
                    value={getCaptionValue(photo)}
                    onChangeText={(v) =>
                      setCaptions((prev) => ({ ...prev, [photo.id]: v }))
                    }
                    onBlur={() => handleCaptionBlur(photo)}
                    placeholder={t('manage.note_ph')}
                    placeholderTextColor={theme.colors.textMuted}
                    multiline
                    maxLength={200}
                  />
                ) : (
                  <Text
                    testID={`note-readonly-${photo.id}`}
                    style={[styles.noteReadOnly, !photo.caption && styles.noteEmpty]}
                  >
                    {photo.caption ?? t('manage.note_ph')}
                  </Text>
                )}
                {isSaving && (
                  <StickerChip label="đang lưu..." variant="ink" />
                )}
              </View>
            </StickerCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconBtn:      { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center' },
  title:        { ...typography.title, color: theme.colors.textPrimary },
  photoCount:   { ...typography.caption, color: theme.colors.textMuted, marginTop: 2 },

  list: { padding: spacing.lg, gap: spacing.lg },

  card:         { padding: 0, overflow: 'hidden' },
  imageContainer: { width: '100%', height: IMAGE_HEIGHT },
  image:        { width: '100%', height: '100%' },

  deleteOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  deleteBtn: {
    width: 36, height: 36,
    padding: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  captionSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: theme.border.hairline,
    borderTopColor: theme.colors.borderSoft,
  },
  pencilWrapper: { marginTop: 2 },
  noteInput: {
    ...typography.body,
    color: theme.colors.textPrimary,
    flex: 1,
    minHeight: 40,
    textAlignVertical: 'top',
  },
  noteReadOnly: { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
  noteEmpty:    { color: theme.colors.textMuted, fontStyle: 'italic' },
});
```

### Step 4.2: Add to theme-clean files

```ts
const THEME_CLEAN_APP_FILES = [
  // ...existing...
  'app/story/[albumId]/[date]/manage.tsx',
];
```

### Step 4.3: Verify

- [ ] `cd mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (16 specs).
- [ ] `cd mobile && npx tsc --noEmit` — clean.
- [ ] `cd mobile && npx jest --silent` — baseline.

### Step 4.4: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/story/\[albumId\]/\[date\]/manage.tsx mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(manage-day): migrate to Sticker World components

Header back button becomes a butter StickerCard icon; each photo card
is now a StickerCard with alternating tilt. Delete overlay nests a
StickerCard around the trash icon. Saving indicator switches from
plain text to a StickerChip variant="ink". Background uses
theme.colors.background. manage.tsx joins THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Day grid (spec line 600): ✓ Task 1 covers butter sticker icons, alternating-tilt cells, video badge as `StickerChip variant="ink"`, Mascot empty state, archived banner as `StickerChip variant="ink"`, rename modal upgraded.
- Story viewer (spec line 608): ✓ Task 2 covers sticker top bar + date chip, progress bar restyle, sticker menu dropdown, theme-overlay gradient.
- Photo detail (spec line 617): ✓ Task 3 covers sticker close + yellow date chip + caption StickerCard. The reaction row in the spec is deferred — current screen has no reactions UI yet, so wiring one is a larger feature, not a visual migration.
- Manage day (spec line 626): ✓ Task 4 covers sticker header, alternating-tilt photo cards, sticker delete overlay, sticker saving indicator.

**What this plan does NOT do:**
- Add reactions to the photo-detail screen — defer as feature work.
- Migrate the radial-gradient background (spec line 293) — defer; legacy `colors.cream` alias gives flat butter for now.
- Touch the timeline / album list / settings / sheets — out of scope for Plan 4.

**Token usage summary:**
- Day grid: `theme.colors.{background,textPrimary,textSecondary,textMuted,primary,border,borderSoft,error}`, `theme.overlays.scrim`, `theme.border.{hairline,thin}`, `theme.typography.*`.
- Story viewer: `theme.overlays.{cameraBg,surfaceOnDark,scrimSoft,scrimDeep}`, `theme.colors.{textPrimary,surface,border,borderSoft,accent1,error}`, `theme.border.{hairline,thin}`.
- Photo detail: `theme.overlays.cameraBg`, `theme.colors.textPrimary`.
- Manage day: `theme.colors.{background,textPrimary,textMuted,borderSoft}`, `theme.border.hairline`.

No new theme tokens are added by this plan.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-sticker-world-browse-experience.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Batch with checkpoints.

**Which approach?**
