# Tab Bar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat icon tab bar with a floating pill that slides between two text-label tabs using a spring animation.

**Architecture:** `CustomTabBar` becomes a self-contained absolute-positioned pill. It owns a single `Animated.Value` for the sliding background, measures its own width via `onLayout`, and syncs to `activePage` prop changes (swipes) as well as its own press handler (taps). The parent `index.tsx` needs no changes — the props interface is identical.

**Tech Stack:** React Native `Animated` (core), `Caveat_600SemiBold` (already loaded), `react-native-safe-area-context`

---

## File Map

| Action | Path |
|---|---|
| Create | `mobile/src/components/tabs/__tests__/CustomTabBar.test.tsx` |
| Rewrite | `mobile/src/components/tabs/CustomTabBar.tsx` |
| Verify (no change) | `mobile/app/(tabs)/index.tsx` |

---

## Task 1: Write failing tests for CustomTabBar

**Files:**
- Create: `mobile/src/components/tabs/__tests__/CustomTabBar.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// mobile/src/components/tabs/__tests__/CustomTabBar.test.tsx

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34, top: 0, left: 0, right: 0 }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CustomTabBar } from '../CustomTabBar';

const setup = (activePage = 1) => {
  const onTabPress = jest.fn();
  const utils = render(<CustomTabBar activePage={activePage} onTabPress={onTabPress} />);
  return { ...utils, onTabPress };
};

describe('CustomTabBar', () => {
  it('renders camera tab with correct testID', () => {
    const { getByTestId } = setup();
    expect(getByTestId('tab-camera')).toBeTruthy();
  });

  it('renders albums tab with correct testID', () => {
    const { getByTestId } = setup();
    expect(getByTestId('tab-albums')).toBeTruthy();
  });

  it('renders Vietnamese label for camera tab', () => {
    const { getByText } = setup();
    expect(getByText('Chụp ảnh')).toBeTruthy();
  });

  it('renders Vietnamese label for albums tab', () => {
    const { getByText } = setup();
    expect(getByText('Nhật ký')).toBeTruthy();
  });

  it('calls onTabPress(0) when camera tab is pressed', () => {
    const { getByTestId, onTabPress } = setup();
    fireEvent.press(getByTestId('tab-camera'));
    expect(onTabPress).toHaveBeenCalledWith(0);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });

  it('calls onTabPress(1) when albums tab is pressed', () => {
    const { getByTestId, onTabPress } = setup();
    fireEvent.press(getByTestId('tab-albums'));
    expect(onTabPress).toHaveBeenCalledWith(1);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests — expect them to FAIL**

```bash
cd mobile && npx jest src/components/tabs/__tests__/CustomTabBar.test.tsx --no-coverage
```

Expected: **FAIL** — the existing `CustomTabBar` uses `Ionicons`, not text labels, so `getByText('Chụp ảnh')` and `getByText('Nhật ký')` will throw.

---

## Task 2: Rewrite CustomTabBar

**Files:**
- Rewrite: `mobile/src/components/tabs/CustomTabBar.tsx`

- [ ] **Step 1: Replace the file with the new implementation**

```tsx
// mobile/src/components/tabs/CustomTabBar.tsx

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

const PADDING = 5;
const GAP = 4;

interface Props {
  activePage: number;
  onTabPress: (index: number) => void;
}

export function CustomTabBar({ activePage, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [containerWidth, setContainerWidth] = useState(0);
  const isFirstLayout = useRef(true);

  const tabWidth = containerWidth > 0 ? (containerWidth - PADDING * 2 - GAP) / 2 : 0;

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  // Sync indicator to activePage — handles both swipes and initial position
  React.useEffect(() => {
    if (tabWidth === 0) return;
    const toX = activePage === 0 ? 0 : tabWidth + GAP;
    if (isFirstLayout.current) {
      slideAnim.setValue(toX);
      isFirstLayout.current = false;
      return;
    }
    Animated.spring(slideAnim, {
      toValue: toX,
      stiffness: 200,
      damping: 20,
      useNativeDriver: true,
    }).start();
  }, [activePage, tabWidth]);

  const handlePress = (index: number) => {
    onTabPress(index);
    if (tabWidth > 0) {
      const toX = index === 0 ? 0 : tabWidth + GAP;
      Animated.spring(slideAnim, {
        toValue: toX,
        stiffness: 200,
        damping: 20,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View
      style={[styles.bar, { bottom: insets.bottom + 12 }]}
      onLayout={handleLayout}
    >
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.activePill,
            { width: tabWidth, transform: [{ translateX: slideAnim }] },
          ]}
        />
      )}

      <TouchableOpacity
        testID="tab-camera"
        style={styles.tab}
        onPress={() => handlePress(0)}
        activeOpacity={0.8}
      >
        <Text style={[styles.label, activePage === 0 ? styles.labelActive : styles.labelInactive]}>
          Chụp ảnh
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        testID="tab-albums"
        style={styles.tab}
        onPress={() => handlePress(1)}
        activeOpacity={0.8}
      >
        <Text style={[styles.label, activePage === 1 ? styles.labelActive : styles.labelInactive]}>
          Nhật ký
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: PADDING,
    gap: GAP,
    shadowColor: colors.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  activePill: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    backgroundColor: colors.pink,
    borderRadius: 9999,
    shadowColor: colors.pinkDeep,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    zIndex: 1,
  },
  label: {
    fontFamily: 'Caveat_600SemiBold',
    fontSize: 17,
    lineHeight: 20,
  },
  labelActive: {
    color: colors.white,
  },
  labelInactive: {
    color: colors.inkMuted,
  },
});
```

- [ ] **Step 2: Run the CustomTabBar tests — expect PASS**

```bash
cd mobile && npx jest src/components/tabs/__tests__/CustomTabBar.test.tsx --no-coverage
```

Expected: **PASS** — all 6 tests green.

- [ ] **Step 3: Run the existing index integration tests — expect PASS**

```bash
cd mobile && npx jest app/\(tabs\)/__tests__/index.test.tsx --no-coverage
```

Expected: **PASS** — that test file mocks `CustomTabBar` entirely, so the rewrite doesn't affect it.

- [ ] **Step 4: Commit**

```bash
cd mobile && git add src/components/tabs/__tests__/CustomTabBar.test.tsx src/components/tabs/CustomTabBar.tsx
git commit -m "feat(mobile): floating pill tab bar with Caveat labels and spring animation"
```

---

## Task 3: Full test suite verification

**Files:** none changed

- [ ] **Step 1: Run full test suite**

```bash
cd mobile && npx jest --no-coverage
```

Expected: **all tests pass**. If coverage thresholds are checked (`npx jest --coverage`), the new test file covers the rewritten `CustomTabBar.tsx` — threshold should stay above 90%.

- [ ] **Step 2: Smoke-test visually in the simulator**

```bash
cd mobile && npx expo start
```

Open on iOS simulator. Verify:
- Pill bar floats above the bottom edge (does not push PagerView up)
- "Chụp ảnh" / "Nhật ký" labels visible in Caveat handwriting font
- Active tab fills pink with dark-pink hard shadow
- Tapping a tab: pill slides immediately with a slight spring bounce
- Swiping the PagerView: pill slides to match the page once swipe settles
- Safe area padding correct on devices with home indicator (iPhone 14+)
