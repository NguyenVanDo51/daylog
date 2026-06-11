# Sticker World — Capture Flow Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the Sticker World direction to the three highest-traffic screens — Home (Albums list), Camera, and Photo Review — using the components built in `docs/superpowers/plans/2026-06-11-sticker-world-foundation.md`. After this plan, the daily capture loop (open app → see albums → tap pill → camera → capture → review → save) feels like Sticker World end-to-end.

**Architecture:**
- Each screen migration removes inline `rgba()` and raw color literals in favor of either compatibility tokens (`colors.cream`, `colors.ink`) or new semantic tokens (`theme.overlays.scrim`, `theme.overlays.cameraBg`).
- Each migration applies the new sticker components (`StickerCard`, `StickerChip`, `StickerButton`, `Mascot`, `Avatar`) per the descriptions in the design spec.
- After each screen migration, the file is added to `THEME_CLEAN_FILES` in `hex-literal-guard.test.ts` so future raw-color regressions break the build.

**Tech Stack:** React Native (Expo 56), TypeScript, Jest + jest-expo, @testing-library/react-native, existing `expo-camera`, `expo-video`, `expo-router`, `react-native-pager-view`, `react-native-reanimated`, `react-native-gesture-handler`.

**Spec:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` — relevant sections: "Sign-in" is OUT of scope (Plan 3); "Home / Albums" (line 569), "Camera" (line 600), "Photo Review" (line 609).

**Depends on:** Foundation plan landed (commits `d1506f5..718148e`).

---

## File Structure

```
mobile/
├── src/
│   ├── constants/
│   │   └── theme.ts                              ← MODIFIED (add overlays slot)
│   ├── components/
│   │   └── tabs/
│   │       ├── AlbumsPage.tsx                    ← REWRITTEN (Task 2)
│   │       └── CameraPage.tsx                    ← REWRITTEN (Task 3)
│   ├── locales/
│   │   ├── vi.ts                                 ← MODIFIED (Task 2: one new string)
│   │   └── en.ts                                 ← MODIFIED (Task 2: one new string)
│   └── __tests__/
│       └── hex-literal-guard.test.ts             ← MODIFIED in Tasks 2, 3, 4 (extend THEME_CLEAN_FILES)
└── app/
    └── photo-review.tsx                          ← REWRITTEN (Task 4)
```

Each task is self-contained: one screen's migration + that screen joining `THEME_CLEAN_FILES`. If a step fails, the previous tasks' screens stay theme-clean.

---

## Task 1: Add `theme.overlays` slot to the Theme interface

The three screens use semi-transparent overlays that can't be expressed with existing semantic colors:
- Modal/sheet backdrops (`rgba(0,0,0,0.4)`)
- Photo-review top/bottom scrims (`rgba(0,0,0,0.55)`, `rgba(0,0,0,0.82)`)
- Glass-effect chips against the camera feed or dark photo background (`rgba(255,255,255,0.12)` etc.)
- Camera background (`#000000`)

These belong in theme so future themes can re-tint them (e.g., a warm-paper theme might use `rgba(60,40,30,0.4)` for the scrim instead of pure black).

**Files:**
- Modify: `mobile/src/constants/theme.ts`
- Modify: `mobile/src/constants/theme.test.ts`

- [ ] **Step 1: Update the test**

In `mobile/src/constants/theme.test.ts`, add a new describe block before the closing `})` of the outer describe:

```ts
  describe('Theme.overlays', () => {
    it('exposes named overlay tokens', () => {
      const keys = ['scrim', 'scrimDeep', 'scrimSoft', 'surfaceOnDark', 'borderOnDark', 'cameraBg'] as const;
      keys.forEach((k) => expect(typeof theme.overlays[k]).toBe('string'));
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/constants/theme.test.ts
```

Expected: FAIL — `theme.overlays` is undefined.

- [ ] **Step 3: Extend the Theme interface**

In `mobile/src/constants/theme.ts`, add this to the `Theme` interface (after the `background` field, before `components`):

```ts
  overlays: {
    scrim:         string;  // modal / sheet backdrop
    scrimDeep:     string;  // bottom gradient end on photo backgrounds
    scrimSoft:     string;  // top gradient start on photo backgrounds
    surfaceOnDark: string;  // chip background on dark surfaces (camera, photo)
    borderOnDark:  string;  // chip border on dark surfaces
    cameraBg:      string;  // camera screen background
  };
```

- [ ] **Step 4: Populate the stickerWorld overlays**

In `mobile/src/constants/theme.ts`, add this to the `stickerWorld: Theme` object (after the `background:` field, before `components:`):

```ts
  overlays: {
    scrim:         'rgba(0,0,0,0.4)',
    scrimDeep:     'rgba(0,0,0,0.82)',
    scrimSoft:     'rgba(0,0,0,0.55)',
    surfaceOnDark: 'rgba(255,255,255,0.12)',
    borderOnDark:  'rgba(255,255,255,0.22)',
    cameraBg:      '#000000',
  },
```

- [ ] **Step 5: Verify test passes**

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/constants/theme.test.ts
```

Expected: PASS (11 specs now: 10 previous + 1 new).

- [ ] **Step 6: Typecheck**

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit
```

Expected: clean (TS5101 baseUrl deprecation OK).

- [ ] **Step 7: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/constants/theme.ts mobile/src/constants/theme.test.ts
git commit -m "$(cat <<'EOF'
feat(theme): add overlays slot for scrims and dark-surface chips

Adds theme.overlays (scrim, scrimDeep, scrimSoft, surfaceOnDark,
borderOnDark, cameraBg) so the capture-flow screens (Home modal,
Camera, Photo Review) can express semi-transparent overlays through
theme tokens instead of inline rgba literals.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate `AlbumsPage` (Home / Albums list)

Refactor `mobile/src/components/tabs/AlbumsPage.tsx` to use `Mascot`, `StickerCard`, `StickerChip`, `StickerButton`, and `Avatar`. Replace the inline-styled `Modal` overlay with theme overlay tokens. Drop the local style block for elements now covered by components.

**Spec reference:** `docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md` lines 569-583.

**Files:**
- Modify: `mobile/src/components/tabs/AlbumsPage.tsx`
- Modify: `mobile/src/locales/vi.ts` (add `albums.empty_cta`)
- Modify: `mobile/src/locales/en.ts` (add `albums.empty_cta`)
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts` (add file to THEME_CLEAN_FILES)

### Step 2.1: Add the new i18n strings

- [ ] In `mobile/src/locales/vi.ts`, update the `albums` block:

```ts
  albums: {
    title:     'Album của tôi',
    private:   'Cá nhân',
    new_album: 'Album mới',
    empty:     'Chưa có album nào',
    empty_cta: 'Tạo album đầu tiên',
    create_error: 'Không thể tạo album.',
    rename_ph: 'Tên album...',
  },
```

- [ ] In `mobile/src/locales/en.ts`, add the matching keys to the `albums` block (use `Create your first album`, `Cannot create album.`, `Album name…` as English equivalents).

### Step 2.2: Rewrite `AlbumsPage.tsx`

The new file is below. Replace the entire contents of `mobile/src/components/tabs/AlbumsPage.tsx` with this:

```tsx
import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { router } from 'expo-router';
import { DotsThree, PlusCircle, Camera, CaretRight } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAlbums, Album } from '@/hooks/useAlbums';
import { useAlbumStore } from '@/stores/albumStore';
import { SettingsSheet } from './SettingsSheet';
import { api } from '@/lib/api';
import { theme, colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { Mascot } from '@/components/ui/Mascot';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { Avatar } from '@/components/ui/Avatar';

interface Props {
  onCameraPress: () => void;
}

export function AlbumsPage({ onCameraPress }: Props) {
  const insets = useSafeAreaInsets();
  const { data: albums, isLoading } = useAlbums();
  const setAlbum = useAlbumStore((s) => s.setAlbum);
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  function handleAlbumPress(album: Album) {
    setAlbum(album);
    router.push(`/albums/${album.id}`);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { data } = await api.post('/albums', { name });
      setShowInput(false);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      setAlbum(data);
      router.push(`/albums/${data.id}`);
    } catch {
      Alert.alert(t('common.error'), t('albums.create_error'));
    } finally {
      setCreating(false);
    }
  }

  const sorted = albums
    ? [...albums.filter((a) => a.is_private), ...albums.filter((a) => !a.is_private)]
    : [];

  const SWATCHES = theme.colors.swatch;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Modal visible={showInput} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <StickerCard shadow="heavy" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('albums.new_album')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('albums.rename_ph')}
              placeholderTextColor={theme.colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowInput(false)} style={styles.modalBtn}>
                <Text style={styles.modalBtnCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={creating} style={styles.modalBtn}>
                <Text style={styles.modalBtnConfirm}>{creating ? '...' : t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </StickerCard>
        </View>
      </Modal>

      <View style={styles.header}>
        <Mascot size={24} tilt="playful" flip />
        <Text style={styles.heading}>Nhật ký</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} testID="menu-btn">
          <DotsThree size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Mascot size={80} tilt="default" />
          <Text style={styles.empty}>{t('albums.empty')}</Text>
          <StickerButton
            label={t('albums.empty_cta')}
            variant="primary"
            onPress={() => { setNewName(''); setShowInput(true); }}
            testID="create-album-empty-btn"
          />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => { setNewName(''); setShowInput(true); }}
              testID="create-album-btn"
            >
              <PlusCircle size={20} color={theme.colors.primary} />
              <Text style={styles.createBtnText}>{t('albums.new_album')}</Text>
            </TouchableOpacity>
          }
          renderItem={({ item, index }) => (
            <StickerCard
              tilt="subtle"
              flip={index % 2 === 1}
              style={styles.row}
              testID={`album-row-${item.id}`}
            >
              <TouchableOpacity
                onPress={() => handleAlbumPress(item)}
                activeOpacity={0.85}
                style={styles.rowInner}
              >
                <Avatar
                  size={48}
                  src={item.cover_thumb_url ?? null}
                  bgColor={(['accent1','accent2','accent3','accent4'] as const)[index % 4]}
                />
                <View style={styles.rowInfo}>
                  <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
                </View>
                {typeof (item as any).photo_count === 'number' && (
                  <StickerChip
                    label={String((item as any).photo_count)}
                    variant="yellow"
                    tilt="default"
                    flip
                  />
                )}
                <CaretRight size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </StickerCard>
          )}
        />
      )}

      <View style={[styles.bottomArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        <StickerButton
          label="Chụp ảnh"
          variant="primary"
          shadow="heavy"
          icon={<Camera size={18} color={theme.colors.textOnPrimary} weight="fill" />}
          onPress={onCameraPress}
          testID="camera-pill-btn"
        />
      </View>

      <SettingsSheet visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: theme.colors.background },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing['2xl'], paddingVertical: spacing.lg },
  heading:         { ...typography.displayCute, flex: 1 },
  menuBtn:         { padding: spacing.sm },
  emptyWrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing['3xl'] },
  empty:           { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center' },
  list:            { paddingHorizontal: spacing['2xl'], gap: spacing.md, paddingBottom: spacing['2xl'] },
  row:             { marginBottom: spacing.sm },
  rowInner:        { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, minHeight: 64 },
  rowInfo:         { flex: 1 },
  albumName:       { ...typography.title, color: theme.colors.textPrimary },
  bottomArea:      { alignItems: 'center', paddingTop: spacing.md },
  createBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  createBtnText:   { ...typography.body, color: theme.colors.primary },
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

### Step 2.3: Add `AlbumsPage.tsx` to the theme-clean files list

- [ ] Edit `mobile/src/__tests__/hex-literal-guard.test.ts`. Update the `THEME_CLEAN_FILES` constant to add the new entry at the bottom:

```ts
const THEME_CLEAN_FILES = [
  'src/components/ui/Mascot.tsx',
  'src/components/ui/StickerCard.tsx',
  'src/components/ui/StickerChip.tsx',
  'src/components/ui/StickerButton.tsx',
  'src/components/ui/Avatar.tsx',
  'src/components/tabs/AlbumsPage.tsx',
];
```

### Step 2.4: Run the suite

- [ ] Run the hex-literal guard:

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/__tests__/hex-literal-guard.test.ts
```

Expected: PASS (6 specs).

- [ ] Run the full mobile suite:

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest --silent
```

Expected: baseline + the new theme overlay spec. No new failures.

- [ ] Run typecheck:

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit
```

Expected: clean (TS5101 OK).

### Step 2.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/tabs/AlbumsPage.tsx mobile/src/locales/vi.ts mobile/src/locales/en.ts mobile/src/__tests__/hex-literal-guard.test.ts
git commit -m "$(cat <<'EOF'
refactor(albums-page): migrate to Sticker World components

Replaces inline-styled rows and modal with StickerCard, the photo-count
badge with StickerChip, the create-album CTA and capture pill with
StickerButton, and the empty state with Mascot + StickerButton.
Compositions read from theme tokens; the modal scrim moves to
theme.overlays.scrim. AlbumsPage joins THEME_CLEAN_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate `CameraPage`

Replace top-bar icons with butter `StickerCard` icon buttons, swap `MediaCaption` time strip for a tilted yellow `StickerChip`, render the hint as an ink `StickerChip`, enlarge the shutter with ink border + offset shadow, and replace the permission modal with `StickerCard` + `StickerButton`. All raw `'#000'` / `'rgba(...)'` become `theme.overlays.*`.

**Spec reference:** lines 600-608.

**Files:**
- Modify: `mobile/src/components/tabs/CameraPage.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`

### Step 3.1: Rewrite `CameraPage.tsx`

Replace the entire contents of `mobile/src/components/tabs/CameraPage.tsx` with this:

```tsx
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, AppState, Linking, Modal } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router } from 'expo-router';
import { X, CameraRotate } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { theme, colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';

const HINT_KEY = 'capture.hint_seen';

interface Props {
  onTabPress: (index: number) => void;
}

function formatClock(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function CameraPage({ onTabPress }: Props) {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [clock, setClock] = useState<string>(formatClock);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

  React.useEffect(() => {
    if (permissionResponse && !permissionResponse.granted && permissionResponse.canAskAgain !== false) {
      requestPermission();
    }
  }, [permissionResponse?.granted, permissionResponse?.canAskAgain]);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && recordingRef.current) {
        cameraRef.current?.stopRecording();
        recordingRef.current = false;
        progress.value = 0;
      }
    });
    return () => sub.remove();
  }, []);

  function handleMediaCaptured(asset: { type: 'photo' | 'video'; uri: string; durationMs?: number }) {
    usePhotoReviewStore.getState().setAssets([{
      uri: asset.uri,
      type: asset.type,
      source: 'camera',
      durationMs: asset.durationMs,
      takenAt: new Date().toISOString(),
    }]);
    router.push('/photo-review');
  }

  async function takePhoto() {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85, skipProcessing: true });
    if (photo) handleMediaCaptured({ type: 'photo', uri: photo.uri });
  }

  async function startRecord() {
    if (recordingRef.current) return;
    recordingRef.current = true;
    const start = Date.now();
    progress.value = withTiming(1, { duration: 2000, easing: Easing.linear });
    const video = await cameraRef.current?.recordAsync({ maxDuration: 2 });
    const durationMs = Math.min(Date.now() - start, 2000);
    recordingRef.current = false;
    cancelAnimation(progress);
    progress.value = 0;
    if (video) handleMediaCaptured({ type: 'video', uri: video.uri, durationMs });
  }

  function stopRecord() {
    if (recordingRef.current) cameraRef.current?.stopRecording();
  }

  const tapGesture = Gesture.Tap().runOnJS(true).onStart(takePhoto);
  const longPressGesture = Gesture.LongPress().minDuration(250).runOnJS(true)
    .onStart(startRecord).onFinalize(stopRecord);
  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible>
          <View style={styles.permOverlay}>
            <StickerCard shadow="heavy" style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <StickerButton
                label={t('capture.perm_open')}
                variant="primary"
                fullWidth
                onPress={() => Linking.openSettings()}
              />
            </StickerCard>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity testID="close-btn" onPress={() => onTabPress(1)} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <X size={20} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CameraRotate size={20} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
      </View>

      <View style={styles.clockArea} pointerEvents="none">
        <StickerChip label={clock} variant="yellow" tilt="playful" flip />
      </View>

      {showHint && (
        <View style={styles.hintArea} pointerEvents="none">
          <StickerChip label={t('capture.hint_video')} variant="ink" />
        </View>
      )}

      <View style={[styles.shutterArea, { paddingBottom: insets.bottom + spacing['2xl'] }]}>
        <GestureDetector gesture={composed}>
          <View style={styles.shutterOuter}>
            <Animated.View style={[styles.progressArc, progressStyle]} />
            <View style={styles.shutterInner} />
          </View>
        </GestureDetector>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: theme.overlays.cameraBg },
  topBar:       { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xl, zIndex: 10 },
  iconBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', padding: 0 },
  clockArea:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  hintArea:     { position: 'absolute', bottom: 160, left: 0, right: 0, alignItems: 'center' },
  shutterArea:  { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  shutterOuter: {
    width: 76, height: 76, borderRadius: 38,
    borderWidth: theme.border.thick, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    ...theme.shadows.stickerHeavy,
    backgroundColor: theme.colors.surface,
  },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: theme.colors.primary, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, borderWidth: theme.border.medium, borderColor: theme.colors.border },
  permOverlay:  { flex: 1, backgroundColor: theme.overlays.scrimDeep, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: spacing['2xl'], paddingBottom: spacing['3xl'] },
  permSheet:    { width: '100%', padding: spacing['2xl'], gap: spacing.md },
  permTitle:    { ...typography.title, color: theme.colors.textPrimary },
  permBody:     { ...typography.body, color: theme.colors.textSecondary },
});
```

**Notes on the rewrite:**
- The previous file imported `MediaCaption` for the time strip — removed in favor of `<StickerChip variant="yellow" />`.
- The previous `iconBtn` was `rgba(0,0,0,0.4)` circle; now it's a butter `StickerCard`. The outer `<TouchableOpacity>` keeps the `testID="close-btn"` so the existing `CameraPage.test.tsx` and the parent `index.test.tsx` mock still work — the testID moves to the TouchableOpacity wrapper that's still tappable.
- The shutter is enlarged with the ink-bordered outer ring; the inner circle is pink with a thin ink border per the spec ("Inner circle becomes pink instead of white when not recording").
- The hint text uses `theme.colors.textPrimary` on yellow via `StickerChip variant="ink"` per the spec.

### Step 3.2: Update the existing CameraPage test (only if it asserts on inline styles)

- [ ] Run the existing test first:

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/components/tabs/__tests__/CameraPage.test.tsx
```

If it passes, skip to Step 3.3. If it fails because it asserts on the old `closeBtn` style, the assertions need updating: the close button's testID is now on the outer `TouchableOpacity` (unchanged), and the close icon size is now 20 instead of 28. Update only the failing assertions; do not remove tests.

### Step 3.3: Add to theme-clean list

- [ ] Edit `mobile/src/__tests__/hex-literal-guard.test.ts`:

```ts
const THEME_CLEAN_FILES = [
  'src/components/ui/Mascot.tsx',
  'src/components/ui/StickerCard.tsx',
  'src/components/ui/StickerChip.tsx',
  'src/components/ui/StickerButton.tsx',
  'src/components/ui/Avatar.tsx',
  'src/components/tabs/AlbumsPage.tsx',
  'src/components/tabs/CameraPage.tsx',
];
```

### Step 3.4: Run the suite

- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (7 specs).
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/components/tabs/__tests__/CameraPage.test.tsx` — PASS.
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit` — clean (TS5101 OK).
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest --silent` — baseline.

### Step 3.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/src/components/tabs/CameraPage.tsx mobile/src/__tests__/hex-literal-guard.test.ts
# Add the CameraPage test file ONLY if it was modified
git status mobile/src/components/tabs/__tests__/CameraPage.test.tsx
# If status shows modified, also: git add mobile/src/components/tabs/__tests__/CameraPage.test.tsx
git commit -m "$(cat <<'EOF'
refactor(camera-page): migrate to Sticker World components

Replaces dark-circle top-bar buttons with butter StickerCard icons,
swaps the MediaCaption time strip for a tilted yellow StickerChip,
renders the first-time hint as a StickerChip variant="ink", and
upgrades the shutter to a sticker-shadowed ring with a pink inner
circle. Camera background and modal scrim move to theme.overlays.
Permission modal uses StickerCard + StickerButton. CameraPage joins
THEME_CLEAN_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate `photo-review.tsx`

Replace the inline-rgba top bar, time/caption strips, album chips, and save button with the new sticker components. Gradient overlays read from `theme.overlays.scrimSoft` / `scrimDeep`. The save button uses `variant="inverted"` for the "ink-on-photo" effect called out in the spec.

**Spec reference:** lines 609-617.

**Files:**
- Modify: `mobile/app/photo-review.tsx`
- Modify: `mobile/src/__tests__/hex-literal-guard.test.ts`
- Possibly modify: `mobile/app/__tests__/photo-review.test.tsx` if its assertions break.

### Step 4.1: Rewrite `photo-review.tsx`

Replace the entire contents of `mobile/app/photo-review.tsx` with this:

```tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  KeyboardAvoidingView, Platform, Keyboard, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';
import { router } from 'expo-router';
import { XIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { useCapture, type UploadResult } from '@/hooks/useCapture';
import { useAlbums } from '@/hooks/useAlbums';
import { useLastAlbumSelection } from '@/hooks/useLastAlbumSelection';
import { Confetti } from '@/components/ui/Confetti';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
import { success } from '@/lib/haptics';
import { t } from '@/lib/i18n';

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export default function PhotoReviewScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const assets = usePhotoReviewStore((s) => s.assets);
  const clear = usePhotoReviewStore((s) => s.clear);
  const { startBackgroundUpload, finishCapture } = useCapture();
  const { data: albums = [] } = useAlbums();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [caption, setCaption] = useState('');
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const uploadPromiseRef = useRef<Promise<UploadResult> | undefined>(undefined);
  const { savedIds, persist } = useLastAlbumSelection();
  const initializedRef = useRef(false);

  const asset = assets[0];

  useEffect(() => {
    if (assets.length === 0) { router.back(); return; }
    uploadPromiseRef.current = startBackgroundUpload(asset);
  }, []);

  useEffect(() => {
    if (initializedRef.current || savedIds === null || albums.length === 0) return;
    initializedRef.current = true;
    const valid = savedIds.filter((id) => albums.some((a) => a.id === id));
    if (valid.length > 0) setSelectedIds(new Set(valid));
  }, [savedIds, albums]);

  if (assets.length === 0 || !asset) return null;

  const timeStr = asset.takenAt
    ? new Date(asset.takenAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';

  function toggleAlbum(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSave() {
    const albumIds = Array.from(selectedIds);
    setSaving(true);
    try {
      const result = await uploadPromiseRef.current!;
      await finishCapture(result, asset, albumIds, caption.trim() || null);
      if (albumIds.length > 0) void persist(albumIds);
      success();
      setCelebrate(true);
      setTimeout(() => { setCelebrate(false); clear(); router.dismissAll(); }, 1300);
    } catch {
      Alert.alert(t('common.error'), t('photo_review.save_error') ?? 'Không thể lưu ảnh. Thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.container}>
          <StatusBar hidden />

          {asset.type === 'video' ? (
            <VideoPreview uri={asset.uri} />
          ) : (
            <Image source={{ uri: asset.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          )}

          <LinearGradient
            colors={[theme.overlays.scrimSoft, 'transparent']}
            style={[styles.gradientTop, { paddingTop: insets.top }]}
          >
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-close" hitSlop={8}>
                <StickerCard style={styles.closeBtn}>
                  <XIcon size={20} color={theme.colors.textPrimary} weight="bold" />
                </StickerCard>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { clear(); router.back(); }} testID="review-retake">
                <StickerChip label={t('capture.retake')} variant="yellow" />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <View style={styles.timeArea} pointerEvents="box-none">
            {timeStr ? (
              <StickerChip label={timeStr} variant="yellow" tilt="playful" flip />
            ) : null}
          </View>

          <View style={styles.captionArea}>
            <StickerCard style={styles.captionCard}>
              <TextInput
                testID="review-note-input"
                style={styles.captionInput}
                value={caption}
                onChangeText={setCaption}
                placeholder={t('photo_review.note_ph')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
              />
            </StickerCard>
          </View>

          <LinearGradient
            colors={['transparent', theme.overlays.scrimDeep]}
            style={[styles.gradientBottom, { paddingBottom: insets.bottom + spacing.lg }]}
          >
            <View style={styles.albumChips}>
              {albums.map((album) => {
                const selected = selectedIds.has(album.id);
                return (
                  <TouchableOpacity
                    key={album.id}
                    testID={`album-checkbox-${album.id}`}
                    onPress={() => toggleAlbum(album.id)}
                    activeOpacity={0.7}
                  >
                    <StickerChip
                      label={selected ? `✓ ${album.name}` : album.name}
                      variant={selected ? 'pink' : 'white'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <StickerButton
              testID="review-save"
              label="Lưu vào nhật ký"
              variant="inverted"
              shadow="heavy"
              fullWidth
              loading={saving}
              disabled={selectedIds.size === 0}
              onPress={handleSave}
            />
          </LinearGradient>

          <Confetti visible={celebrate} />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.overlays.cameraBg,
  },
  gradientTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingBottom: spacing['2xl'],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 36, height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  timeArea: {
    position: 'absolute',
    top: '22%',
    left: 0, right: 0,
    alignItems: 'center',
  },
  captionArea: {
    position: 'absolute',
    top: '32%',
    left: spacing['2xl'], right: spacing['2xl'],
  },
  captionCard: {
    padding: spacing.md,
  },
  captionInput: {
    ...typography.body,
    color: theme.colors.textPrimary,
    minHeight: 36,
    maxHeight: 96,
  },
  gradientBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing['4xl'],
    gap: spacing.md,
  },
  albumChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
```

**Notes on the rewrite:**
- The previous file imported `MediaCaption` for the inline caption editor; that's replaced by a `StickerCard` with a plain `TextInput`. The `testID="review-note-input"` is preserved.
- The selected-chip pattern uses `variant="pink"` with a leading `✓` to keep the visual asymmetry from the previous selected state, but everything stays in the sticker vocabulary.
- The save button text "Lưu vào nhật ký" is a literal here (not yet in i18n). The previous file also had the literal "Lưu lại". If the i18n key is desired, add `photo_review.save_to_diary: 'Lưu vào nhật ký'` to `vi.ts`/`en.ts` and replace the literal — but the plan does not require this since the existing photo-review used literals throughout.

### Step 4.2: Verify the existing photo-review test still passes

- [ ] Run:

```
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/photo-review.test.tsx
```

If it fails, the failures are likely on (a) the old `albumTile`/`saveBtn` style assertions, or (b) the `confetti` timing. Update only the broken assertions to use the new testIDs (which are unchanged: `review-close`, `review-retake`, `review-note-input`, `review-save`, `album-checkbox-${id}`). Do not remove tests.

### Step 4.3: Add to theme-clean list

- [ ] Edit `mobile/src/__tests__/hex-literal-guard.test.ts`:

```ts
const THEME_CLEAN_FILES = [
  'src/components/ui/Mascot.tsx',
  'src/components/ui/StickerCard.tsx',
  'src/components/ui/StickerChip.tsx',
  'src/components/ui/StickerButton.tsx',
  'src/components/ui/Avatar.tsx',
  'src/components/tabs/AlbumsPage.tsx',
  'src/components/tabs/CameraPage.tsx',
  // app/photo-review.tsx is at a different relative root; use the app/ prefix:
];

const THEME_CLEAN_APP_FILES = [
  'app/photo-review.tsx',
];
```

And update the body of the describe block to test both arrays:

```ts
describe('hex-literal guard', () => {
  it.each(THEME_CLEAN_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
    runGuard(abs, rel);
  });
  it.each(THEME_CLEAN_APP_FILES)('%s contains no raw hex or rgba literals', (rel) => {
    const abs = path.resolve(__dirname, '../../', rel);
    runGuard(abs, rel);
  });
});

function runGuard(abs: string, rel: string): void {
  const src = fs.readFileSync(abs, 'utf8');
  const stripped = src.replace(/\/\/.*$/gm, '');
  const match = stripped.match(HEX_OR_RGBA);
  if (match) {
    const line = stripped.slice(0, match.index).split('\n').length;
    throw new Error(
      `${rel}:${line} contains a raw color literal "${match[0]}". ` +
      `All colors must come from theme.colors.* (see Theme System section ` +
      `of docs/superpowers/specs/2026-06-11-sticker-world-redesign-design.md).`,
    );
  }
}
```

### Step 4.4: Run the suite

- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest src/__tests__/hex-literal-guard.test.ts` — PASS (8 specs).
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/photo-review.test.tsx` — PASS.
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit` — clean (TS5101 OK).
- [ ] `cd /Users/do.nguyen/personal/family-guy/mobile && npx jest --silent` — baseline.

### Step 4.5: Commit

```bash
cd /Users/do.nguyen/personal/family-guy
git add mobile/app/photo-review.tsx mobile/src/__tests__/hex-literal-guard.test.ts
# Add the photo-review test ONLY if modified.
git status mobile/app/__tests__/photo-review.test.tsx
# If shown as modified: git add mobile/app/__tests__/photo-review.test.tsx
git commit -m "$(cat <<'EOF'
refactor(photo-review): migrate to Sticker World components

Top bar uses a butter StickerCard close icon + yellow StickerChip
retake. The time strip becomes a tilted yellow StickerChip; caption
input lives inside a StickerCard. Album selection switches from custom
tile styles to StickerChip (white unselected, pink selected). Save
button becomes a full-width inverted StickerButton with the heavy
shadow so it reads against any photo. Gradients consume
theme.overlays.scrimSoft / scrimDeep. photo-review.tsx joins
THEME_CLEAN_APP_FILES.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- Home / Albums (spec lines 569-583): ✓ Task 2 covers Mascot + displayCute heading, alternating-tilt rows, photo-count chip, capture-pill `StickerButton`, empty state with Mascot + CTA, create-album modal with StickerCard + StickerButton. Photo-count chip is gated on `photo_count` field existing on the album — if backend doesn't return it, the chip is hidden (spec line 580).
- Camera (spec lines 600-608): ✓ Task 3 covers butter top-bar icons, tilted yellow time chip, ink hint chip, enlarged ink-bordered shutter with pink interior, permission modal upgrade.
- Photo Review (spec lines 609-617): ✓ Task 4 covers butter close icon, yellow retake chip, tilted yellow time chip, StickerCard caption, white/pink album chips, inverted heavy-shadow save button.

**Scope discipline:**
- The plan does NOT migrate the day-grid, story viewer, photo detail, settings, sheets, sign-in, or onboarding — all deferred to Plans 3-5.
- The plan does NOT touch the album cover-photo upload flow or the upload progress UI.
- The plan does NOT add new behavior; every interactive element keeps its existing handlers, testIDs, and state machine.

**Open items intentionally deferred:**
- `photo_count` on the album row needs the `/albums` backend response to include it. If not present, the chip simply doesn't render (`typeof item.photo_count === 'number'` guard). Surfacing this is a follow-up.
- The "Lưu vào nhật ký" save button text is a literal in photo-review.tsx; adding it to `vi.ts`/`en.ts` is a tiny polish task that can be folded into a later screen migration.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-11-sticker-world-capture-flow.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task with two-stage review.

**2. Inline Execution** — Batch with checkpoints.

**Which approach?**
