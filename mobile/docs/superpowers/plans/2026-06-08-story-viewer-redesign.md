# Story Viewer Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Facebook-Stories-style top bar (progress bars + 3 icon row) with a back button + date chip + `•••` menu, and replace the bottom thumbnail strip with a cinematic day-hero + progress dots.

**Architecture:** All changes are in one file — `mobile/app/story/[albumId]/[date].tsx`. `StoryProgress` is deleted. `VlogOverlay` gains two new props (`dayLabel`, `currentIndex`, `total`) to render the day hero and dots inside its existing gradient. A new `menuOpen` boolean state drives a dropdown overlay.

**Tech Stack:** React Native, Expo Router, `@testing-library/react-native`, Jest

---

## Files

- Modify: `mobile/app/story/[albumId]/[date].tsx` — all UI changes
- Modify: `mobile/app/__tests__/story-screen.test.tsx` — update/add tests

---

### Task 1: Remove StoryProgress, add back button + date chip

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/__tests__/story-screen.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `mobile/app/__tests__/story-screen.test.tsx` inside the `describe` block:

```tsx
it('does not render story-progress bar', () => {
  const { queryByTestId } = render(<StoryScreen />);
  expect(queryByTestId('story-progress')).toBeNull();
});

it('back button calls router.back', () => {
  const { getByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-back'));
  expect(router.back).toHaveBeenCalledTimes(1);
});

it('renders date chip with DD.MM.YYYY format', () => {
  const { getByTestId } = render(<StoryScreen />);
  // route param date is '2026-05-01', chip should show '01.05.2026'
  expect(getByTestId('story-date-chip').props.children).toBe('01.05.2026');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: 2–3 failures — `story-back` not found, `story-date-chip` not found.

- [ ] **Step 3: Implement**

In `mobile/app/story/[albumId]/[date].tsx`:

a) **Delete** the entire `StoryProgress` function and the `pg` `StyleSheet.create({...})` block.

b) **Remove** `photoProgress` state and `setPhotoProgress` — but first check `PhotoItem`: its `onProgress` prop currently calls `setPhotoProgress`. Remove `onProgress` from `PhotoItem`'s prop type and call, then remove `setPhotoProgress` entirely from `StoryScreen`.

   `PhotoItem` becomes:
   ```tsx
   function PhotoItem({ photo, onEnd }: { photo: DayPhoto; onEnd: () => void }) {
     useEffect(() => {
       let cancelled = false;
       const start = Date.now();
       const tick = () => {
         if (cancelled) return;
         const frac = Math.min((Date.now() - start) / PHOTO_DURATION_MS, 1);
         if (frac < 1) requestAnimationFrame(tick);
         else onEnd();
       };
       requestAnimationFrame(tick);
       return () => { cancelled = true; };
     }, [photo.id]);

     return (
       <Image
         source={{ uri: `${API_URL}/photos/${photo.id}/thumb` }}
         style={StyleSheet.absoluteFill}
         contentFit="contain"
       />
     );
   }
   ```

c) **Replace** the `headerOverlay` `View` with a new top bar. Find this block in `StoryScreen`:

   ```tsx
   <View style={[styles.headerOverlay, { paddingTop: insets.top + spacing.sm }]}>
     <View style={styles.progressRow}>
       <StoryProgress total={photos.length} current={currentIndex} progress={photoProgress} />
       <Text style={styles.dateText}>{dateLabel}</Text>
     </View>
     <View style={styles.topActions}>
       <TouchableOpacity
         onPress={() => router.push(`/story/${albumId}/${date}/manage` as any)}
         testID="story-manage"
       >
         <Ionicons name="create-outline" size={26} color={colors.white} />
       </TouchableOpacity>
       {exporting ? (
         <ActivityIndicator color={colors.white} size="small" style={{ width: 32 }} />
       ) : (
         <TouchableOpacity onPress={exportStory} testID="story-export" disabled={exporting}>
           <Ionicons name="arrow-down-circle-outline" size={26} color={colors.white} />
         </TouchableOpacity>
       )}
       <TouchableOpacity onPress={() => router.back()} testID="story-close">
         <Ionicons name="close" size={26} color={colors.white} />
       </TouchableOpacity>
     </View>
   </View>
   ```

   Replace with:
   ```tsx
   <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
     <TouchableOpacity onPress={() => router.back()} testID="story-back" style={styles.circleBtn}>
       <Ionicons name="chevron-back" size={18} color={colors.white} />
     </TouchableOpacity>
     <Text style={styles.dateChip} testID="story-date-chip">{dateChip}</Text>
     <TouchableOpacity onPress={() => setMenuOpen(true)} testID="story-menu-btn" style={styles.circleBtn}>
       <Text style={styles.menuDots}>•••</Text>
     </TouchableOpacity>
   </View>
   ```

d) Add `dateChip` derived value near `dateLabel`:
   ```tsx
   const parts = (date ?? '').split('-');
   const dateLabel = parts.length === 3 ? `${parts[2]}/${parts[1]}` : '';
   const dateChip  = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : '';
   ```

e) Add `menuOpen` state near the other `useState` calls:
   ```tsx
   const [menuOpen, setMenuOpen] = useState(false);
   ```

f) **Update styles** — remove `headerOverlay`, `progressRow`, `dateText`, `topActions`. Add:
   ```tsx
   topBar:    { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
                paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
   circleBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.35)',
                alignItems: 'center', justifyContent: 'center' },
   dateChip:  { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 7,
                paddingVertical: 3, paddingHorizontal: 8, ...typography.caption,
                color: 'rgba(255,255,255,0.75)', fontFamily: 'Courier New', letterSpacing: 0.5 },
   menuDots:  { color: colors.white, fontSize: 12, letterSpacing: 1, lineHeight: 14 },
   ```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: all pass including `does not render story-progress bar`, `back button calls router.back`, `renders date chip`.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/story/\[albumId\]/\[date\].tsx mobile/app/__tests__/story-screen.test.tsx
git commit -m "feat(mobile): replace story top bar with back+chip+menu button"
```

---

### Task 2: Menu dropdown (Sửa / Lưu / Xoá)

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/__tests__/story-screen.test.tsx`

- [ ] **Step 1: Write failing tests**

Add inside the `describe` block in `story-screen.test.tsx`:

```tsx
it('menu is hidden by default', () => {
  const { queryByTestId } = render(<StoryScreen />);
  expect(queryByTestId('story-menu-dropdown')).toBeNull();
});

it('menu opens when menu button is pressed', () => {
  const { getByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-menu-btn'));
  expect(getByTestId('story-menu-dropdown')).toBeTruthy();
});

it('Sửa ghi chú navigates to manage screen', () => {
  const { getByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-menu-btn'));
  fireEvent.press(getByTestId('story-menu-edit'));
  expect(router.push).toHaveBeenCalledWith('/story/test-album/2026-05-01/manage');
});

it('Lưu về máy calls exportStory', () => {
  const exportStoryMock = jest.fn();
  const { useStoryExport } = require('@/hooks/useStoryExport');
  useStoryExport.mockReturnValue({ exporting: false, exportStory: exportStoryMock });
  const { getByTestId } = render(<StoryScreen />);
  fireEvent.press(getByTestId('story-menu-btn'));
  fireEvent.press(getByTestId('story-menu-export'));
  expect(exportStoryMock).toHaveBeenCalledTimes(1);
});
```

Note: the existing mocks use `useLocalSearchParams` returning `{ albumId: 'test-album', date: '2026-05-01' }` — check your mock setup. If `useLocalSearchParams` is not mocked, add at the top of the test file:

```tsx
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ albumId: 'test-album', date: '2026-05-01' }),
}));
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: failures for `story-menu-dropdown`, `story-menu-edit`, `story-menu-export` not found.

- [ ] **Step 3: Implement**

In `StoryScreen`'s return, add the dropdown immediately after the `<View style={[styles.topBar, ...]}>` block:

```tsx
{menuOpen && (
  <TouchableOpacity
    style={styles.menuBackdrop}
    activeOpacity={1}
    onPress={() => setMenuOpen(false)}
    testID="story-menu-backdrop"
  >
    <View style={styles.menuDropdown} testID="story-menu-dropdown">
      <TouchableOpacity
        style={styles.menuItem}
        testID="story-menu-edit"
        onPress={() => {
          setMenuOpen(false);
          router.push(`/story/${albumId}/${date}/manage` as any);
        }}
      >
        <Ionicons name="create-outline" size={16} color={colors.white} />
        <Text style={styles.menuItemText}>Sửa ghi chú</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.menuItem}
        testID="story-menu-export"
        onPress={() => {
          setMenuOpen(false);
          exportStory();
        }}
        disabled={exporting}
      >
        {exporting
          ? <ActivityIndicator color={colors.white} size="small" />
          : <Ionicons name="arrow-down-circle-outline" size={16} color={colors.white} />}
        <Text style={styles.menuItemText}>Lưu về máy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.menuItem, styles.menuItemDanger]}
        testID="story-menu-delete"
        onPress={() => {
          setMenuOpen(false);
          Alert.alert('Xoá ảnh', 'Tính năng này sẽ có sớm.');
        }}
      >
        <Ionicons name="trash-outline" size={16} color="#ff6b6b" />
        <Text style={[styles.menuItemText, { color: '#ff6b6b' }]}>Xoá ảnh</Text>
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
)}
```

Add `Alert` to the React Native imports at the top of the file:
```tsx
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  useWindowDimensions, ActivityIndicator, Alert,
} from 'react-native';
```

Add styles:
```tsx
menuBackdrop:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 },
menuDropdown:   { position: 'absolute', top: 48, right: spacing.lg,
                  backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 12,
                  overflow: 'hidden', minWidth: 160,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
menuItem:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
                  paddingVertical: 12, paddingHorizontal: spacing.lg,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: 'rgba(255,255,255,0.1)' },
menuItemDanger: { borderBottomWidth: 0 },
menuItemText:   { ...typography.body, color: colors.white, fontSize: 13 },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/story/\[albumId\]/\[date\].tsx mobile/app/__tests__/story-screen.test.tsx
git commit -m "feat(mobile): add story action menu with edit, export, delete"
```

---

### Task 3: Bottom overlay — day hero + progress dots

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`
- Modify: `mobile/app/__tests__/story-screen.test.tsx`

- [ ] **Step 1: Write failing tests**

Add inside the `describe` block:

```tsx
it('renders day hero with DD / MM format', () => {
  const { getByTestId } = render(<StoryScreen />);
  // date param is '2026-05-01' → day hero should show '01 / 05'
  expect(getByTestId('story-day-hero').props.children).toBe('01 / 05');
});

it('renders correct number of progress dots', () => {
  const { getAllByTestId, getByTestId } = render(<StoryScreen />);
  // 2 photos in the mock → 1 active + 1 inactive = 2 total
  const inactive = getAllByTestId('story-dot');
  const active = getByTestId('story-dot-active');
  expect(inactive.length + 1).toBe(2); // 1 inactive + 1 active
  expect(active).toBeTruthy();
});

it('first dot is marked active by testID at initial index 0', () => {
  const { getByTestId, queryByTestId } = render(<StoryScreen />);
  // dot index 0 is active at start
  expect(getByTestId('story-dot-active')).toBeTruthy();
  // only one active dot
  expect(queryByTestId('story-dot-active')).not.toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: failures — `story-day-hero` and `story-dot` not found.

- [ ] **Step 3: Implement**

Update `VlogOverlay` to accept `dayLabel`, `currentIndex`, and `total` props, and render them inside the gradient:

```tsx
function VlogOverlay({
  photo,
  dayLabel,
  currentIndex,
  total,
}: {
  photo: DayPhoto;
  dayLabel: string;
  currentIndex: number;
  total: number;
}) {
  const dt = new Date(photo.taken_at);
  const timeStr = dt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
      style={vlog.container}
      pointerEvents="none"
    >
      <Text style={vlog.dayHero} testID="story-day-hero">{dayLabel}</Text>
      <Text style={vlog.date} testID="vlog-date">{dateStr}</Text>
      <Text style={vlog.time} testID="vlog-time">▶ {timeStr}</Text>
      {photo.caption?.trim() ? <Text style={vlog.caption} testID="vlog-caption">{photo.caption}</Text> : null}
      <View style={vlog.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            testID={i === currentIndex ? 'story-dot-active' : 'story-dot'}
            style={[vlog.dot, i === currentIndex && vlog.dotActive]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}
```

Update the `vlog` stylesheet — add `dayHero`, `dots`, `dot`, `dotActive`:

```tsx
const vlog = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.xl * 2,
    zIndex: 10,
  },
  dayHero: {
    fontSize: 26,
    fontWeight: '200',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 3,
    fontFamily: 'Georgia',
    marginBottom: 4,
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
  dots: {
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  dot: {
    width: 5, height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
});
```

Update the `<VlogOverlay />` call in `StoryScreen` to pass the new props:

```tsx
<VlogOverlay
  photo={current}
  dayLabel={dateLabel}
  currentIndex={currentIndex}
  total={photos.length}
/>
```

Where `dateLabel` is already `${parts[2]}/${parts[1]}` — change it to use ` / ` spacing:
```tsx
const dateLabel = parts.length === 3 ? `${parts[2]} / ${parts[1]}` : '';
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd mobile && npx jest app/__tests__/story-screen.test.tsx --no-coverage
```

Expected: all pass.

- [ ] **Step 5: Run full test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass, including `story-vlog-overlay.test.tsx` (it tests VlogOverlay in isolation with the old signature — if it fails, update its local copy of VlogOverlay to match the new signature, or note that it's an independent inline component in the test file and therefore unaffected).

- [ ] **Step 6: Commit**

```bash
git add mobile/app/story/\[albumId\]/\[date\].tsx mobile/app/__tests__/story-screen.test.tsx
git commit -m "feat(mobile): add day hero text and progress dots to story bottom overlay"
```
