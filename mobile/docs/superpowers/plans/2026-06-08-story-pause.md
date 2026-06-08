# Story Viewer Pause/Resume + Progress Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tap-to-pause/resume to the story viewer with a thin progress line at the bottom of the screen.

**Architecture:** All changes live in `mobile/app/story/[albumId]/[date].tsx`. `PhotoItem` and `VideoItem` gain `isPaused` + `onProgress` props. `StoryScreen` gains `isPaused`/`photoProgress` state and a centre tap zone. `VlogOverlay` gains an `isPaused` prop to toggle the `▶`/`⏸` prefix.

**Tech Stack:** React Native, expo-video, `@testing-library/react-native`, Jest

---

## Files

- Modify: `mobile/app/story/[albumId]/[date].tsx` — all changes
- Modify: `mobile/app/__tests__/story-screen.test.tsx` — new tests

---

### Task 1: PhotoItem — isPaused + onProgress + elapsed tracking

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx` (lines 22–43)

No isolated tests for this internal component — integration tested in Task 3.

- [ ] **Step 1: Replace PhotoItem with the new implementation**

Replace the entire `PhotoItem` function (lines 22–43) with:

```tsx
function PhotoItem({
  photo,
  onEnd,
  isPaused,
  onProgress,
}: {
  photo: DayPhoto;
  onEnd: () => void;
  isPaused: boolean;
  onProgress: (f: number) => void;
}) {
  const elapsedRef = useRef(0);

  useEffect(() => {
    elapsedRef.current = 0;
  }, [photo.id]);

  useEffect(() => {
    if (isPaused) return;
    let cancelled = false;
    const startTime = Date.now() - elapsedRef.current;
    const tick = () => {
      if (cancelled) return;
      const frac = Math.min((Date.now() - startTime) / PHOTO_DURATION_MS, 1);
      onProgress(frac);
      if (frac < 1) requestAnimationFrame(tick);
      else { elapsedRef.current = 0; onEnd(); }
    };
    requestAnimationFrame(tick);
    return () => {
      elapsedRef.current = Date.now() - startTime;
      cancelled = true;
    };
  }, [photo.id, isPaused]);

  return (
    <Image
      source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
    />
  );
}
```

How this works:
- `elapsedRef` stores how many ms have elapsed on the current photo. Reset to 0 when `photo.id` changes.
- When `isPaused` becomes `true`: the effect cleanup runs, saves `elapsedRef.current = Date.now() - startTime`, cancels the loop. The new effect (with `isPaused=true`) returns immediately.
- When `isPaused` becomes `false`: the effect restarts with `startTime = Date.now() - elapsedRef.current`, continuing from where it left off.
- `onProgress(frac)` is called on every tick to drive the progress line in `StoryScreen`.

- [ ] **Step 2: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy && git add 'mobile/app/story/[albumId]/[date].tsx' && git commit -m "feat(mobile): PhotoItem pause/resume with elapsed tracking and onProgress"
```

---

### Task 2: VideoItem — isPaused + onProgress + player control

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx` (lines 45–64)

No isolated tests — integration tested through StoryScreen (mock data only has photos; video path is covered by expo-video's own tests).

- [ ] **Step 1: Replace VideoItem with the new implementation**

Replace the entire `VideoItem` function (lines 45–64) with:

```tsx
function VideoItem({
  photo,
  onEnd,
  isPaused,
  onProgress,
}: {
  photo: DayPhoto;
  onEnd: () => void;
  isPaused: boolean;
  onProgress: (f: number) => void;
}) {
  const player = useVideoPlayer(`${API_URL}/photos/${photo.id}/full`, (p) => {
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener('playToEnd', onEnd);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (isPaused) player.pause();
    else player.play();
  }, [isPaused, player]);

  useEffect(() => {
    const id = setInterval(() => {
      const dur = player.duration;
      if (!dur || isNaN(dur) || dur === 0) { onProgress(0); return; }
      onProgress(Math.min(player.currentTime / dur, 1));
    }, 200);
    return () => clearInterval(id);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}
```

How this works:
- `isPaused` change → `player.pause()` / `player.play()`.
- Progress polling: every 200 ms, reads `player.currentTime / player.duration` (0–1) and calls `onProgress`. Guards against `NaN`/zero duration.
- On video end, `onEnd` is called via the `playToEnd` listener (unchanged).

- [ ] **Step 2: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy && git add 'mobile/app/story/[albumId]/[date].tsx' && git commit -m "feat(mobile): VideoItem pause/resume with player control and progress polling"
```

---

### Task 3: StoryScreen + VlogOverlay — state, zones, pause icon, progress line

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/__tests__/story-screen.test.tsx`

- [ ] **Step 1: Write failing tests**

Add inside the `describe('StoryScreen navigation', ...)` block in `mobile/app/__tests__/story-screen.test.tsx`:

```tsx
it('renders a centre pause button', () => {
  const { getByTestId } = render(<StoryScreen />);
  expect(getByTestId('story-pause-btn')).toBeTruthy();
});

it('pause icon is hidden by default', () => {
  const { queryByTestId } = render(<StoryScreen />);
  expect(queryByTestId('story-pause-icon')).toBeNull();
});

it('tapping centre shows the pause icon', () => {
  const { getByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-pause-btn'));
  expect(getByTestId('story-pause-icon')).toBeTruthy();
});

it('tapping centre twice resumes — hides pause icon', () => {
  const { getByTestId, queryByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-pause-btn'));
  fireEvent.press(getByTestId('story-pause-btn'));
  expect(queryByTestId('story-pause-icon')).toBeNull();
});

it('tapping next while paused resumes playback', () => {
  const { getByTestId, queryByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-pause-btn'));
  fireEvent.press(getByTestId('story-next'));
  expect(queryByTestId('story-pause-icon')).toBeNull();
});

it('tapping prev while paused resumes playback', () => {
  const { getByTestId, queryByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-pause-btn'));
  fireEvent.press(getByTestId('story-next')); // go to index 1 first
  fireEvent.press(getByTestId('story-pause-btn')); // pause at index 1
  fireEvent.press(getByTestId('story-prev'));
  expect(queryByTestId('story-pause-icon')).toBeNull();
});

it('renders progress line', () => {
  const { getByTestId } = render(<StoryScreen />);
  expect(getByTestId('story-progress-line')).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: 7 new failures — `story-pause-btn` not found, `story-pause-icon` not found, `story-progress-line` not found.

- [ ] **Step 3: Add isPaused and photoProgress state to StoryScreen**

In `StoryScreen`, find the existing state declarations (around line 112):
```tsx
const [currentIndex, setCurrentIndex] = useState(0);
const [menuOpen, setMenuOpen] = useState(false);
```

Add two new state variables immediately after:
```tsx
const [currentIndex, setCurrentIndex] = useState(0);
const [menuOpen, setMenuOpen] = useState(false);
const [isPaused, setIsPaused] = useState(false);
const [photoProgress, setPhotoProgress] = useState(0);
```

- [ ] **Step 4: Add togglePause callback**

Add `togglePause` after `goPrev`:

```tsx
const togglePause = useCallback(() => setIsPaused((p) => !p), []);
```

- [ ] **Step 5: Update goNext and goPrev to reset isPaused and photoProgress**

Replace the existing `goNext`:
```tsx
const goNext = useCallback(() => {
  if (!photos) return;
  if (currentIndex < photos.length - 1) {
    setCurrentIndex((i) => i + 1);
  } else {
    setCurrentIndex(0);
  }
  setIsPaused(false);
  setPhotoProgress(0);
}, [photos, currentIndex]);
```

Replace the existing `goPrev`:
```tsx
const goPrev = useCallback(() => {
  if (currentIndex > 0) {
    setCurrentIndex((i) => i - 1);
    setIsPaused(false);
    setPhotoProgress(0);
  }
}, [currentIndex]);
```

- [ ] **Step 6: Wire isPaused and onProgress into PhotoItem and VideoItem**

Find the media render block (currently around line 164):
```tsx
{current.media_type === 'video' ? (
  <VideoItem photo={current} onEnd={goNext} />
) : (
  <PhotoItem photo={current} onEnd={goNext} />
)}
```

Replace with:
```tsx
{current.media_type === 'video' ? (
  <VideoItem
    photo={current}
    onEnd={goNext}
    isPaused={isPaused}
    onProgress={setPhotoProgress}
  />
) : (
  <PhotoItem
    photo={current}
    onEnd={goNext}
    isPaused={isPaused}
    onProgress={setPhotoProgress}
  />
)}
```

- [ ] **Step 7: Replace two tap zones with three**

Find the current `tapAreas` block:
```tsx
<View style={styles.tapAreas}>
  <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
  <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
</View>
```

Replace with:
```tsx
<View style={styles.tapAreas}>
  <TouchableOpacity style={styles.tapLeft} onPress={goPrev} testID="story-prev" />
  <TouchableOpacity style={styles.tapCenter} onPress={togglePause} testID="story-pause-btn" />
  <TouchableOpacity style={styles.tapRight} onPress={goNext} testID="story-next" />
</View>
```

- [ ] **Step 8: Add pause icon**

Add immediately after the `tapAreas` block:
```tsx
{isPaused && (
  <View style={styles.pauseIcon} testID="story-pause-icon" pointerEvents="none">
    <Text style={styles.pauseIconText}>⏸</Text>
  </View>
)}
```

- [ ] **Step 9: Add progress line**

Add immediately after the pause icon block (and before `<VlogOverlay>`):
```tsx
<View style={styles.progressLine} pointerEvents="none" testID="story-progress-line">
  <View
    style={[
      styles.progressFill,
      isPaused ? styles.progressFillPaused : styles.progressFillPlaying,
      { width: `${photoProgress * 100}%` },
    ]}
  />
</View>
```

- [ ] **Step 10: Add isPaused prop to VlogOverlay call site**

Find:
```tsx
<VlogOverlay
  photo={current}
  dayLabel={dateLabel}
  currentIndex={currentIndex}
  total={photos.length}
  bottomInset={insets.bottom}
/>
```

Replace with:
```tsx
<VlogOverlay
  photo={current}
  dayLabel={dateLabel}
  currentIndex={currentIndex}
  total={photos.length}
  bottomInset={insets.bottom}
  isPaused={isPaused}
/>
```

- [ ] **Step 11: Update VlogOverlay signature and time prefix**

Find the `VlogOverlay` function signature:
```tsx
function VlogOverlay({
  photo,
  dayLabel,
  currentIndex,
  total,
  bottomInset = 0,
}: {
  photo: DayPhoto;
  dayLabel: string;
  currentIndex: number;
  total: number;
  bottomInset?: number;
}) {
```

Replace with:
```tsx
function VlogOverlay({
  photo,
  dayLabel,
  currentIndex,
  total,
  bottomInset = 0,
  isPaused = false,
}: {
  photo: DayPhoto;
  dayLabel: string;
  currentIndex: number;
  total: number;
  bottomInset?: number;
  isPaused?: boolean;
}) {
```

Then find the time Text:
```tsx
<Text style={vlog.time} testID="vlog-time">▶ {timeStr}</Text>
```

Replace with:
```tsx
<Text style={vlog.time} testID="vlog-time">{isPaused ? '⏸' : '▶'} {timeStr}</Text>
```

- [ ] **Step 12: Update styles**

In the `styles` StyleSheet, replace:
```tsx
tapLeft:    { flex: 1 },
tapRight:   { flex: 1 },
```

With:
```tsx
tapLeft:    { flex: 3 },
tapCenter:  { flex: 4 },
tapRight:   { flex: 3 },
```

Add new style entries at the bottom of the `styles` StyleSheet (before the closing `}`):
```tsx
pauseIcon: {
  position: 'absolute',
  top: '50%', left: '50%',
  width: 52, height: 52,
  marginTop: -26, marginLeft: -26,
  borderRadius: 26,
  backgroundColor: 'rgba(0,0,0,0.35)',
  alignItems: 'center', justifyContent: 'center',
  zIndex: 15,
  borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
},
pauseIconText: { fontSize: 20, color: colors.white },
progressLine: {
  position: 'absolute', bottom: 0, left: 0, right: 0,
  height: 3, backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 20,
},
progressFill:        { height: '100%', borderRadius: 2 },
progressFillPlaying: { backgroundColor: 'rgba(255,255,255,0.75)' },
progressFillPaused:  { backgroundColor: 'rgba(255,200,68,0.85)' },
```

- [ ] **Step 13: Run tests to verify they pass**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: all pass.

- [ ] **Step 14: Run full test suite**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 15: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy && git add 'mobile/app/story/[albumId]/[date].tsx' mobile/app/__tests__/story-screen.test.tsx && git commit -m "feat(mobile): pause/resume with centre tap zone, pause icon, progress line"
```
