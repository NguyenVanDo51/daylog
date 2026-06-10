# VlogOverlay Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the date label from VlogOverlay, move the time and caption to an upper-center overlay, enlarge the caption, and animate both with a letter-by-letter typewriter reveal on each photo mount.

**Architecture:** VlogOverlay is split into two absolute layers: (1) an upper-center `View` (at `top: '38%'`) holding the time row and caption with typewriter animation via local state + `setInterval`; (2) the existing bottom `LinearGradient` retaining only the nav dots. The parent passes `key={current.id}` so React remounts the component on photo change, resetting animation state automatically. No new dependencies.

**Tech Stack:** React Native, TypeScript, `@testing-library/react-native`, Jest fake timers

---

### Task 1: Rewrite story-vlog-overlay tests

**Files:**
- Modify: `mobile/app/__tests__/story-vlog-overlay.test.tsx`

- [ ] **Step 1: Replace the test file entirely**

Replace all contents of `mobile/app/__tests__/story-vlog-overlay.test.tsx` with the following. These tests will fail until Task 2 implements the real component changes.

```tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children, ...props }: any) =>
      React.createElement(View, props, children),
  };
});

jest.mock('phosphor-react-native', () => ({
  PlayIcon: () => null,
  PauseIcon: () => null,
}));

import { VlogOverlay } from '../story/[albumId]/_components/VlogOverlay';

const makePhoto = (overrides: Partial<{
  id: string; taken_at: string; caption: string | null;
}> = {}) => ({
  id: 'p1',
  media_type: 'photo' as const,
  duration_ms: null,
  taken_at: '2025-12-25T13:42:00Z',
  caption: null,
  uploaded_by: 'u1',
  ...overrides,
});

describe('VlogOverlay — static rendering', () => {
  it('vlog-time row is present', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    expect(getByTestId('vlog-time')).toBeTruthy();
  });

  it('does not render caption element when caption is null', () => {
    const { queryByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: null })} currentIndex={0} total={1} />,
    );
    expect(queryByTestId('vlog-caption')).toBeNull();
  });

  it('does not render caption element when caption is empty string', () => {
    const { queryByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: '' })} currentIndex={0} total={1} />,
    );
    expect(queryByTestId('vlog-caption')).toBeNull();
  });

  it('renders caption element when caption is present', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Buổi sáng' })} currentIndex={0} total={1} />,
    );
    expect(getByTestId('vlog-caption')).toBeTruthy();
  });
});

describe('VlogOverlay — typewriter animation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('time text starts empty on mount', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    expect(getByTestId('vlog-time-text').props.children).toBe('');
  });

  it('time text is non-empty after 500ms', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto()} currentIndex={0} total={1} />,
    );
    act(() => { jest.advanceTimersByTime(500); });
    expect(getByTestId('vlog-time-text').props.children).not.toBe('');
  });

  it('caption starts empty on mount', () => {
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    expect(getByTestId('vlog-caption').props.children).toBe('');
  });

  it('caption reaches full text after enough time', () => {
    // time: 5 chars × 70ms = 350ms + 100ms gap + 8 chars × 35ms = 730ms → use 1200ms
    const { getByTestId } = render(
      <VlogOverlay photo={makePhoto({ caption: 'Xin chào' })} currentIndex={0} total={1} />,
    );
    act(() => { jest.advanceTimersByTime(1200); });
    expect(getByTestId('vlog-caption').props.children).toBe('Xin chào');
  });
});
```

- [ ] **Step 2: Run the tests — verify they fail**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/story-vlog-overlay.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: tests fail with errors like `Cannot find module` or `vlog-time-text` not found.

- [ ] **Step 3: Commit failing tests**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && git add app/__tests__/story-vlog-overlay.test.tsx && git commit -m "test(vlog-overlay): rewrite for typewriter redesign (red)"
```

---

### Task 2: Implement VlogOverlay

**Files:**
- Modify: `mobile/app/story/[albumId]/_components/VlogOverlay.tsx`

- [ ] **Step 1: Replace VlogOverlay.tsx with the new implementation**

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
import { DayPhoto } from '@/hooks/useDayPhotos';
import { colors, fonts, spacing } from '@/constants/theme';

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

  const [displayedTime, setDisplayedTime] = useState('');
  const [displayedCaption, setDisplayedCaption] = useState('');

  useEffect(() => {
    let timeIdx = 0;
    const timeInterval = setInterval(() => {
      timeIdx++;
      setDisplayedTime(timeStr.slice(0, timeIdx));
      if (timeIdx >= timeStr.length) clearInterval(timeInterval);
    }, 70);
    return () => clearInterval(timeInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!caption) return;
    let capInterval: ReturnType<typeof setInterval>;
    const capDelay = setTimeout(() => {
      let capIdx = 0;
      capInterval = setInterval(() => {
        capIdx++;
        setDisplayedCaption(caption.slice(0, capIdx));
        if (capIdx >= caption.length) clearInterval(capInterval);
      }, 35);
    }, timeStr.length * 70 + 100);
    return () => {
      clearTimeout(capDelay);
      clearInterval(capInterval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <View style={styles.upperCenter} pointerEvents="none">
        <View style={styles.timeRow} testID="vlog-time">
          {isPaused
            ? <PauseIcon size={16} color="#ffcc44" weight="fill" />
            : <PlayIcon size={16} color="#ffcc44" weight="fill" />}
          <Text style={styles.time} testID="vlog-time-text">{displayedTime}</Text>
        </View>
        {caption
          ? <Text style={styles.caption} testID="vlog-caption">{displayedCaption}</Text>
          : null}
      </View>

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
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
  upperCenter: {
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
    marginBottom: 8,
  },
  time: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: '#ffcc44',
    letterSpacing: 1,
    textShadowColor: 'rgba(255,180,0,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  caption: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
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
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    width: 18,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
});
```

- [ ] **Step 2: Run VlogOverlay tests — verify they pass**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest app/__tests__/story-vlog-overlay.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: all 8 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && git add app/story/[albumId]/_components/VlogOverlay.tsx && git commit -m "feat(vlog-overlay): upper-center position, typewriter animation, larger caption"
```

---

### Task 3: Update StoryScreen caller

**Files:**
- Modify: `mobile/app/story/[albumId]/[date].tsx`

- [ ] **Step 1: Remove dayLabel prop and add key to VlogOverlay**

In `mobile/app/story/[albumId]/[date].tsx`, find the `<VlogOverlay` usage and make two changes:
1. Remove the `dayLabel={dateLabel}` prop
2. Add `key={current.id}` so React remounts the component (resetting animation) on photo change

The `VlogOverlay` call should change from:
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

to:
```tsx
<VlogOverlay
  key={current.id}
  photo={current}
  currentIndex={currentIndex}
  total={photos.length}
  bottomInset={insets.bottom}
  isPaused={isPaused}
/>
```

Also remove the `dateLabel` variable declaration (line 73: `const dateLabel = ...`) since it is no longer used.

- [ ] **Step 2: Run TypeScript check**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to VlogOverlay props.

- [ ] **Step 3: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && git add "app/story/[albumId]/[date].tsx" && git commit -m "feat(story-screen): pass key to VlogOverlay, drop dayLabel prop"
```

---

### Task 4: Fix story-screen tests

**Files:**
- Modify: `mobile/app/__tests__/story-screen.test.tsx`

- [ ] **Step 1: Remove the story-day-hero test**

Delete the following test block from `mobile/app/__tests__/story-screen.test.tsx` (currently around line 132–138):

```tsx
it('renders day hero with DD / MM format', () => {
  const { getByTestId } = render(<StoryScreen />);
  // date param is '2026-05-01' → day hero should show '01 / 05'
  expect(getByTestId('story-day-hero').props.children).toBe('01 / 05');
});
```

- [ ] **Step 2: Run all tests — verify everything passes**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && npx jest --no-coverage 2>&1 | tail -20
```

Expected: all tests pass, no failures.

- [ ] **Step 3: Commit**

```bash
cd /Users/do.nguyen/personal/family-guy/mobile && git add app/__tests__/story-screen.test.tsx && git commit -m "test(story-screen): remove story-day-hero assertion (element removed)"
```
