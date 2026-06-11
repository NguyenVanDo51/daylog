# MediaCaption Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a shared `MediaCaption` component that renders time + optional caption at `top: 38%` identically across the Camera, Photo Review, and Story View screens.

**Architecture:** Create `MediaCaption` in `src/components/ui/`, then swap out each screen's existing ad-hoc time/caption JSX. The component owns its absolute positioning. It renders a `TextInput` when `editable=true` (photo review only) and a static `Text` otherwise. The story view's typewriter animation and bottom-gradient dots remain in `VlogOverlay` — only the time+caption rendering is delegated.

**Tech Stack:** React Native, TypeScript, `phosphor-react-native` (PlayIcon/PauseIcon), `@testing-library/react-native`, `colors`/`fonts`/`spacing` from `@/constants/theme`.

---

### Task 1: Create MediaCaption component with tests

**Files:**
- Create: `mobile/src/components/ui/MediaCaption.tsx`
- Create: `mobile/src/components/ui/MediaCaption.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `mobile/src/components/ui/MediaCaption.test.tsx`:

```tsx
jest.mock('phosphor-react-native', () => new Proxy({}, { get: (_, name) => String(name) }));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MediaCaption } from '@/components/ui/MediaCaption';

describe('MediaCaption', () => {
  it('renders the time string', () => {
    const { getByTestId } = render(<MediaCaption time="14:32" />);
    expect(getByTestId('media-caption-time').props.children).toBe('14:32');
  });

  it('renders static caption Text when editable is false', () => {
    const { getByTestId } = render(<MediaCaption time="14:32" caption="Buổi sáng" />);
    expect(getByTestId('media-caption-text').props.children).toBe('Buổi sáng');
  });

  it('renders nothing for caption when editable=false and caption is absent', () => {
    const { queryByTestId } = render(<MediaCaption time="14:32" />);
    expect(queryByTestId('media-caption-text')).toBeNull();
  });

  it('renders a TextInput with testID forwarded when editable=true', () => {
    const { getByTestId } = render(
      <MediaCaption
        time="14:32"
        caption=""
        editable
        onCaptionChange={jest.fn()}
        testID="review-note-input"
      />,
    );
    expect(getByTestId('review-note-input')).toBeTruthy();
  });

  it('calls onCaptionChange when text changes in editable mode', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <MediaCaption time="14:32" editable onCaptionChange={onChange} testID="my-input" />,
    );
    fireEvent.changeText(getByTestId('my-input'), 'new text');
    expect(onChange).toHaveBeenCalledWith('new text');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd mobile && npx jest src/components/ui/MediaCaption.test.tsx --no-coverage
```

Expected: `Cannot find module '@/components/ui/MediaCaption'`

- [ ] **Step 3: Create the component**

Create `mobile/src/components/ui/MediaCaption.tsx`:

```tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
import { colors, fonts, spacing } from '@/constants/theme';

interface Props {
  time: string;
  caption?: string;
  editable?: boolean;
  onCaptionChange?: (v: string) => void;
  showPlayIcon?: boolean;
  isPaused?: boolean;
  testID?: string;
}

export function MediaCaption({
  time,
  caption,
  editable = false,
  onCaptionChange,
  showPlayIcon = false,
  isPaused = false,
  testID,
}: Props) {
  return (
    <View style={styles.container} pointerEvents={editable ? 'box-none' : 'none'}>
      <View style={styles.timeRow}>
        {showPlayIcon && (
          isPaused
            ? <PauseIcon size={16} color={colors.pink} weight="fill" />
            : <PlayIcon size={16} color={colors.pink} weight="fill" />
        )}
        <Text testID="media-caption-time" style={styles.time}>{time}</Text>
      </View>
      {editable ? (
        <>
          <TextInput
            testID={testID}
            style={styles.captionInput}
            placeholder="Thêm ghi chú..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={caption}
            onChangeText={onCaptionChange}
            multiline
            maxLength={200}
            autoFocus
            textAlign="center"
            selectionColor={colors.pink}
          />
          <View style={styles.captionUnderline} />
        </>
      ) : caption ? (
        <Text testID="media-caption-text" style={styles.captionText}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  time: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.pink,
    letterSpacing: 1,
    textShadowColor: 'rgba(255,122,168,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  captionText: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: 'rgba(255,255,255,0.95)',
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionInput: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
    width: '82%',
    textAlign: 'center',
  },
  captionUnderline: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
    marginTop: 6,
  },
});
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd mobile && npx jest src/components/ui/MediaCaption.test.tsx --no-coverage
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/ui/MediaCaption.tsx mobile/src/components/ui/MediaCaption.test.tsx
git commit -m "feat(ui): add MediaCaption shared component"
```

---

### Task 2: Update CameraPage to use MediaCaption

**Files:**
- Modify: `mobile/src/components/tabs/CameraPage.tsx`

- [ ] **Step 1: Replace the clock overlay**

In `CameraPage.tsx`, make the following changes:

**a)** Remove the `VI_DAYS` constant and simplify `formatClock` to return only the time string:

Replace:
```ts
const VI_DAYS = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];

// ...

function formatClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    date: `${VI_DAYS[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`,
  };
}
```

With:
```ts
function formatClock(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
```

**b)** Change the `clock` state type:

Replace:
```ts
const [clock, setClock] = useState(formatClock);
```

With:
```ts
const [clock, setClock] = useState<string>(formatClock);
```

**c)** Add the `MediaCaption` import at the top of the file (alongside existing imports):

```ts
import { MediaCaption } from '@/components/ui/MediaCaption';
```

**d)** Replace the clock overlay JSX:

Remove:
```tsx
{/* Clock centered on screen */}
<View style={styles.clockOverlay} pointerEvents="none">
  <Text testID="clock-display" style={styles.clockTime}>{clock.time}</Text>
  <Text style={styles.clockDate}>{clock.date}</Text>
</View>
```

Replace with:
```tsx
<MediaCaption time={clock} />
```

**e)** In the `styles` object, remove `clockOverlay`, `clockTime`, and `clockDate`.

- [ ] **Step 2: Run the full test suite to check nothing broke**

```bash
cd mobile && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all existing tests pass. (CameraPage has no unit tests — visual verification happens at manual test time.)

- [ ] **Step 3: Commit**

```bash
git add mobile/src/components/tabs/CameraPage.tsx
git commit -m "feat(camera): replace clock overlay with MediaCaption"
```

---

### Task 3: Update Photo Review to use MediaCaption

**Files:**
- Modify: `mobile/app/photo-review.tsx`

- [ ] **Step 1: Update photo-review.tsx**

**a)** Add import at the top:

```ts
import { MediaCaption } from '@/components/ui/MediaCaption';
```

**b)** Derive `timeStr` from `asset.takenAt` — add this line just before the `if (assets.length === 0 || !asset) return null;` guard:

```ts
const timeStr = new Date(asset.takenAt).toLocaleTimeString('vi-VN', {
  hour: '2-digit', minute: '2-digit', hour12: false,
});
```

**c)** Replace the caption zone JSX. Remove:

```tsx
{/* Layer 3: caption overlay — vertically centered on screen */}
<View style={styles.captionZone} pointerEvents="box-none">
  <TextInput
    testID="review-note-input"
    style={styles.captionInput}
    placeholder="Thêm ghi chú..."
    placeholderTextColor="rgba(255,255,255,0.5)"
    value={caption}
    onChangeText={setCaption}
    multiline
    maxLength={200}
    autoFocus
    textAlign="center"
    selectionColor={colors.pink}
  />
  <View style={styles.captionUnderline} />
</View>
```

Replace with:

```tsx
<MediaCaption
  time={timeStr}
  caption={caption}
  editable
  onCaptionChange={setCaption}
  testID="review-note-input"
/>
```

**d)** Remove the unused `TextInput` from the React Native import at the top of the file. The import line currently reads:

```ts
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  TextInput, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
```

Remove `TextInput` from it:

```ts
import {
  View, Text, Image, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, StatusBar, useWindowDimensions, Alert,
  KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
```

**e)** In the `styles` object, remove `captionZone`, `captionInput`, and `captionUnderline`.

- [ ] **Step 2: Run existing photo-review tests**

```bash
cd mobile && npx jest app/__tests__/photo-review.test.tsx --no-coverage
```

Expected: all existing tests pass. The `review-note-input` testID is forwarded through `MediaCaption`, so `getByTestId('review-note-input')` and `fireEvent.changeText` continue to work.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/photo-review.tsx
git commit -m "feat(photo-review): replace caption zone with MediaCaption"
```

---

### Task 4: Update VlogOverlay to use MediaCaption

**Files:**
- Modify: `mobile/app/story/[albumId]/_components/VlogOverlay.tsx`

- [ ] **Step 1: Update VlogOverlay.tsx**

**a)** Add import:

```ts
import { MediaCaption } from '@/components/ui/MediaCaption';
```

**b)** Remove the `PlayIcon` and `PauseIcon` imports from `phosphor-react-native`. The import currently reads:

```ts
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
```

Remove it entirely (both icons are now inside `MediaCaption`).

**c)** Replace the `upperCenter` JSX block. Remove:

```tsx
<View style={styles.upperCenter} pointerEvents="none">
  <View style={styles.timeRow} testID="vlog-time">
    {isPaused
      ? <PauseIcon size={16} color={colors.pink} weight="fill" />
      : <PlayIcon size={16} color={colors.pink} weight="fill" />}
    <Text style={styles.time} testID="vlog-time-text">{timeStr}</Text>
  </View>
  {caption
    ? <Text style={styles.caption} testID="vlog-caption">{displayedCaption}</Text>
    : null}
</View>
```

Replace with:

```tsx
<MediaCaption
  time={timeStr}
  caption={displayedCaption || undefined}
  showPlayIcon
  isPaused={isPaused}
/>
```

**d)** In the `styles` object, remove `upperCenter`, `timeRow`, `time`, and `caption`.

- [ ] **Step 2: Run the full test suite**

```bash
cd mobile && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add mobile/app/story/[albumId]/_components/VlogOverlay.tsx
git commit -m "feat(story): replace time/caption block with MediaCaption"
```
