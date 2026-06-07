# Camera Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the camera screen a diary-viewfinder feel: inset sticker-bordered frame, live clock overlay, pink close button, hidden tab bar, portrait-only.

**Architecture:** Two files change. `index.tsx` hides `CustomTabBar` when `activePage === 0` and passes `onTabPress` down to `CameraPage`. `CameraPage` replaces full-bleed layout with an inset bordered view, adds a live clock state updated by `setInterval`, and removes the orientation toggle entirely.

**Tech Stack:** React Native `StyleSheet`, `expo-screen-orientation`, `Caveat_700Bold` / `Caveat_600SemiBold` (already loaded)

---

## File Map

| Action | Path |
|---|---|
| Modify + test | `mobile/app/(tabs)/index.tsx` |
| Modify tests | `mobile/app/(tabs)/__tests__/index.test.tsx` |
| Modify | `mobile/src/components/tabs/CameraPage.tsx` |
| Create | `mobile/src/components/tabs/__tests__/CameraPage.test.tsx` |

---

## Task 1: index.tsx — hide tab bar + pass onTabPress to CameraPage

**Files:**
- Modify tests: `mobile/app/(tabs)/__tests__/index.test.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`

- [ ] **Step 1: Update index.test.tsx with failing tests**

Replace the entire file content:

```tsx
// mobile/app/(tabs)/__tests__/index.test.tsx

// Updated mock: setPage now fires onPageSelected so activePage state updates in tests
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  const PagerView = React.forwardRef(({ children, onPageSelected }: any, ref: any) => {
    const cbRef = React.useRef(onPageSelected);
    React.useEffect(() => { cbRef.current = onPageSelected; });
    React.useImperativeHandle(ref, () => ({
      setPage: jest.fn((page: number) => {
        cbRef.current?.({ nativeEvent: { position: page } });
      }),
    }));
    return React.createElement(View, { testID: 'pager-view' }, children);
  });
  return { __esModule: true, default: PagerView };
});

// Updated mock: exposes onTabPress via a test button so close-btn flow is testable
jest.mock('@/components/tabs/CameraPage', () => ({
  CameraPage: ({ onTabPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    const React = require('react');
    return React.createElement(
      View,
      { testID: 'camera-page' },
      React.createElement(TouchableOpacity, {
        testID: 'camera-close-btn',
        onPress: () => onTabPress(1),
      }),
    );
  },
}));

jest.mock('@/components/tabs/AlbumsPage', () => ({
  AlbumsPage: () => {
    const { View } = require('react-native');
    return require('react').createElement(View, { testID: 'albums-page' });
  },
}));

jest.mock('@/components/tabs/CustomTabBar', () => ({
  CustomTabBar: ({ activePage, onTabPress }: any) => {
    const { View, TouchableOpacity } = require('react-native');
    const React = require('react');
    return React.createElement(
      View,
      { testID: 'custom-tab-bar' },
      React.createElement(TouchableOpacity, { testID: 'tab-camera', onPress: () => onTabPress(0) }),
      React.createElement(TouchableOpacity, { testID: 'tab-albums', onPress: () => onTabPress(1) }),
    );
  },
}));

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MainScreen from '../index';

beforeEach(() => jest.clearAllMocks());

describe('MainScreen', () => {
  it('renders PagerView with camera and albums pages', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('pager-view')).toBeTruthy();
    expect(getByTestId('camera-page')).toBeTruthy();
    expect(getByTestId('albums-page')).toBeTruthy();
  });

  it('renders tab bar when albums page is active (default)', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('custom-tab-bar')).toBeTruthy();
  });

  it('tab bar renders camera and albums tabs', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('tab-camera')).toBeTruthy();
    expect(getByTestId('tab-albums')).toBeTruthy();
  });

  it('hides tab bar when camera page becomes active', async () => {
    const { queryByTestId, getByTestId } = render(<MainScreen />);
    expect(queryByTestId('custom-tab-bar')).toBeTruthy();
    fireEvent.press(getByTestId('tab-camera'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeNull());
  });

  it('shows tab bar again when navigating back to albums via close btn', async () => {
    const { queryByTestId, getByTestId } = render(<MainScreen />);
    fireEvent.press(getByTestId('tab-camera'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeNull());
    fireEvent.press(getByTestId('camera-close-btn'));
    await waitFor(() => expect(queryByTestId('custom-tab-bar')).toBeTruthy());
  });

  it('passes onTabPress to CameraPage', () => {
    const { getByTestId } = render(<MainScreen />);
    expect(getByTestId('camera-close-btn')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — expect 2 new tests to FAIL**

```bash
cd mobile && npx jest "app/\(tabs\)/__tests__/index.test.tsx" --no-coverage
```

Expected: `hides tab bar` and `shows tab bar again` FAIL. Others pass.

- [ ] **Step 3: Update index.tsx**

Replace the entire file:

```tsx
// mobile/app/(tabs)/index.tsx

import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { CameraPage } from '@/components/tabs/CameraPage';
import { AlbumsPage } from '@/components/tabs/AlbumsPage';
import { CustomTabBar } from '@/components/tabs/CustomTabBar';

export default function MainScreen() {
  const pagerRef = useRef<PagerView>(null);
  const [activePage, setActivePage] = useState(1);

  const handleTabPress = (i: number) => pagerRef.current?.setPage(i);

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={1}
        onPageSelected={(e) => setActivePage(e.nativeEvent.position)}
      >
        <View key="0" style={styles.page}>
          <CameraPage onTabPress={handleTabPress} />
        </View>
        <View key="1" style={styles.page}>
          <AlbumsPage />
        </View>
      </PagerView>
      {activePage !== 0 && (
        <CustomTabBar activePage={activePage} onTabPress={handleTabPress} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1 },
  pager: { flex: 1 },
  page:  { flex: 1 },
});
```

- [ ] **Step 4: Run tests — expect all PASS**

```bash
cd mobile && npx jest "app/\(tabs\)/__tests__/index.test.tsx" --no-coverage
```

Expected: **6 tests pass**.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/\(tabs\)/index.tsx mobile/app/\(tabs\)/__tests__/index.test.tsx
git commit -m "feat(mobile): hide tab bar on camera tab, pass onTabPress to CameraPage"
```

---

## Task 2: CameraPage — failing tests

**Files:**
- Create: `mobile/src/components/tabs/__tests__/CameraPage.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
// mobile/src/components/tabs/__tests__/CameraPage.test.tsx

jest.mock('expo-screen-orientation', () => ({
  lockAsync: jest.fn().mockResolvedValue(undefined),
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  OrientationLock: { PORTRAIT_UP: 'PORTRAIT_UP' },
}));

jest.mock('@/stores/photoReviewStore', () => ({
  usePhotoReviewStore: { getState: () => ({ setAssets: jest.fn() }) },
}));

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { CameraPage } from '../CameraPage';
import * as ScreenOrientation from 'expo-screen-orientation';

const setup = (onTabPress = jest.fn()) =>
  render(<CameraPage onTabPress={onTabPress} />);

describe('CameraPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not render orientation toggle button', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('orientation-toggle')).toBeNull();
  });

  it('renders close button', () => {
    const { getByTestId } = setup();
    expect(getByTestId('close-btn')).toBeTruthy();
  });

  it('calls onTabPress(1) when close button is pressed', () => {
    const onTabPress = jest.fn();
    const { getByTestId } = setup(onTabPress);
    fireEvent.press(getByTestId('close-btn'));
    expect(onTabPress).toHaveBeenCalledWith(1);
    expect(onTabPress).toHaveBeenCalledTimes(1);
  });

  it('renders clock display with HH:mm format', () => {
    const { getByTestId } = setup();
    const clock = getByTestId('clock-display');
    expect(clock.props.children).toMatch(/^\d{2}:\d{2}$/);
  });

  it('locks orientation to portrait on mount', async () => {
    await act(async () => { setup(); });
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith('PORTRAIT_UP');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd mobile && npx jest "src/components/tabs/__tests__/CameraPage.test.tsx" --no-coverage
```

Expected: FAIL — existing `CameraPage` still has `orientation-toggle` and no `close-btn`.

---

## Task 3: CameraPage — full implementation

**Files:**
- Modify: `mobile/src/components/tabs/CameraPage.tsx`

- [ ] **Step 1: Replace CameraPage.tsx**

```tsx
// mobile/src/components/tabs/CameraPage.tsx

import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, AppState, Linking, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as ScreenOrientation from 'expo-screen-orientation';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePhotoReviewStore } from '@/stores/photoReviewStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import * as SecureStore from 'expo-secure-store';

const HINT_KEY = 'capture.hint_seen';
const VI_DAYS = ['chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];

interface Props {
  onTabPress: (index: number) => void;
}

function formatClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return {
    time: `${hh}:${mm}`,
    date: `${VI_DAYS[now.getDay()]}, ${now.getDate()} tháng ${now.getMonth() + 1}`,
  };
}

export function CameraPage({ onTabPress }: Props) {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permissionResponse, requestPermission] = useCameraPermissions();
  const [showHint, setShowHint] = useState(false);
  const [clock, setClock] = useState(formatClock);
  const cameraRef = useRef<CameraView>(null);
  const recordingRef = useRef(false);
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }));

  // Portrait lock
  React.useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
  }, []);

  // Live clock — ticks every second
  React.useEffect(() => {
    const id = setInterval(() => setClock(formatClock()), 1000);
    return () => clearInterval(id);
  }, []);

  // First-launch hint
  React.useEffect(() => {
    SecureStore.getItemAsync(HINT_KEY).then((seen) => {
      if (!seen) {
        setShowHint(true);
        setTimeout(() => setShowHint(false), 3000);
        SecureStore.setItemAsync(HINT_KEY, '1');
      }
    });
  }, []);

  // Stop recording when app backgrounds
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
    .onStart(startRecord).onEnd(stopRecord).onFinalize(stopRecord);
  const composed = Gesture.Exclusive(longPressGesture, tapGesture);

  if (!permissionResponse) return <View style={styles.container} />;

  if (!permissionResponse.granted) {
    if (permissionResponse.canAskAgain !== false) requestPermission();
    return (
      <View style={styles.container}>
        <Modal transparent animationType="fade" visible>
          <View style={styles.permOverlay}>
            <View style={styles.permSheet}>
              <Text style={styles.permTitle}>{t('capture.perm_title')}</Text>
              <Text style={styles.permBody}>{t('capture.perm_body')}</Text>
              <TouchableOpacity style={styles.permBtn} onPress={() => Linking.openSettings()}>
                <Text style={styles.permBtnText}>{t('capture.perm_open')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Inset bordered viewfinder */}
      <View
        style={[
          styles.viewfinder,
          { top: insets.top + spacing.sm, bottom: insets.bottom + spacing['3xl'] + 60 },
        ]}
      >
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} mode="video" mute />

        {/* Close (left) + Flip (right) */}
        <View style={styles.topBar}>
          <TouchableOpacity testID="close-btn" style={styles.closeBtn} onPress={() => onTabPress(1)}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.flipBtn}
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Live clock centered in viewfinder */}
        <View style={styles.clockOverlay} pointerEvents="none">
          <Text testID="clock-display" style={styles.clockTime}>{clock.time}</Text>
          <Text style={styles.clockDate}>{clock.date}</Text>
        </View>
      </View>

      {/* First-launch hint */}
      {showHint && (
        <View style={styles.hint}>
          <Text style={styles.hintText}>{t('capture.hint_video')}</Text>
        </View>
      )}

      {/* Shutter */}
      <View style={[styles.shutterArea, { bottom: insets.bottom + spacing.lg }]}>
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
  container: { flex: 1, backgroundColor: colors.cream },

  viewfinder: {
    position: 'absolute', left: spacing.lg, right: spacing.lg,
    borderRadius: 18, borderWidth: 2, borderColor: colors.ink,
    shadowColor: colors.ink, shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1, shadowRadius: 0, elevation: 4, overflow: 'hidden',
  },

  topBar: {
    position: 'absolute', top: 10, left: 10, right: 10,
    flexDirection: 'row', justifyContent: 'space-between', zIndex: 10,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.pink, borderWidth: 1.5, borderColor: colors.ink,
    shadowColor: colors.ink, shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 1, shadowRadius: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: colors.white, fontWeight: '700' },
  flipBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },

  clockOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  clockTime: {
    fontFamily: 'Caveat_700Bold', fontSize: 42, color: colors.white,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  clockDate: {
    fontFamily: 'Caveat_600SemiBold', fontSize: 15,
    color: 'rgba(255,255,255,0.6)', marginTop: 4,
  },

  shutterArea:  { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  shutterOuter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  progressArc:  { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: colors.pink, borderTopColor: 'transparent', borderRightColor: 'transparent' },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.white },

  hint:        { position: 'absolute', bottom: 160, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
  hintText:    { ...typography.caption, color: colors.white, fontSize: 13 },
  permOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'flex-end' },
  permSheet:   { width: '100%', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing['2xl'], gap: spacing.md },
  permTitle:   { ...typography.title, color: colors.ink },
  permBody:    { ...typography.body, color: colors.inkSoft },
  permBtn:     { backgroundColor: colors.pink, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  permBtnText: { ...typography.body, color: colors.white, fontWeight: '700' },
});
```

- [ ] **Step 2: Run CameraPage tests — expect PASS**

```bash
cd mobile && npx jest "src/components/tabs/__tests__/CameraPage.test.tsx" --no-coverage
```

Expected: **5 tests pass**.

- [ ] **Step 3: Run full test suite — expect all pass**

```bash
cd mobile && npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/components/tabs/__tests__/CameraPage.test.tsx mobile/src/components/tabs/CameraPage.tsx
git commit -m "feat(mobile): inset viewfinder, live clock, close btn, portrait-only camera"
```

---

## Task 4: Smoke-test in simulator

- [ ] **Step 1: Start Expo**

```bash
cd mobile && npx expo start
```

Verify in iOS simulator:
- Camera screen: cream background visible above and below the viewfinder rectangle
- Viewfinder has ink border + hard shadow (sticker look)
- Current time (HH:mm) and Vietnamese date centered in viewfinder, updates every second
- Pink ✕ button top-left inside viewfinder — pressing navigates to Albums and tab bar reappears
- Flip camera button top-right inside viewfinder
- No orientation toggle button anywhere
- Tab bar hidden while on camera tab, visible on Albums tab
- Swiping PagerView to camera hides the tab bar; swiping back shows it
