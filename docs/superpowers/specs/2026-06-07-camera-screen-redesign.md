# Camera Screen — Actual Implementation

**Date:** 2026-06-07  
**Updated:** 2026-06-09 (reflect actual implementation — inset/cream surround not built)  
**Status:** Implemented

## Summary

Full-bleed black camera viewfinder with live clock overlay, close button, and portrait lock. No cream surround or bordered inset frame.

## Layout

`CameraPage` receives `onTabPress: (index: number) => void` from `(tabs)/index.tsx`.

### Container
`backgroundColor: '#000'`, `flex: 1`

### Camera
`CameraView` with `StyleSheet.absoluteFill` — full bleed, black background.

### Top bar
`position: absolute`, `top: 0`, `paddingTop: insets.top + spacing.md`, `paddingHorizontal: spacing.xl`, `flexDirection: row`, `justifyContent: space-between`, `zIndex: 10`

| Element | Spec |
|---|---|
| Close button | 40×40, transparent bg, white X icon (Phosphor `X`, size 28). On press: `onTabPress(1)` |
| Flip button | 40×40, `borderRadius: 20`, `rgba(0,0,0,0.4)` bg, `CameraRotate` icon (Phosphor, size 24, white) |

### Clock overlay
`position: absolute`, fills screen, `alignItems: center`, `justifyContent: center`, `zIndex: 5`, `pointerEvents="none"`

| Element | Value |
|---|---|
| Time | `fonts.bold`, 52px, `colors.white`, `letterSpacing: 2`, soft black text shadow |
| Date | `fonts.semiBold`, 18px, `rgba(255,255,255,0.75)`, `marginTop: 4` |
| Time format | `HH:mm` (24h) |
| Date format | `thứ X, D tháng M` (Vietnamese day names array) |
| Update interval | `setInterval` every 1000ms, cleared on unmount |

### Shutter area
`position: absolute`, `bottom: 0`, `paddingBottom: insets.bottom + spacing['2xl']`, centered

- Outer ring: 76×76, `borderRadius: 38`, `borderWidth: 4`, white
- Progress arc: `Animated.View`, same dimensions, pink border rotating
- Inner button: 60×60, `borderRadius: 30`, white fill

### Gestures (`react-native-gesture-handler`)
- Tap → `takePhoto()`
- LongPress (minDuration 250ms) → `startRecord()` / `stopRecord()`
- Composed: `Gesture.Exclusive(longPress, tap)`

## Behavior

### Portrait lock
On mount: `ScreenOrientation.lockAsync(PORTRAIT_UP)`. Cleaned up on unmount.

### Video recording
`maxDuration: 2` seconds. Progress arc animates via `Animated.Value` with `withTiming(1, {duration: 2000})`. Cancelled on stop.

### On capture
Sets `usePhotoReviewStore` assets and `router.push('/photo-review')`.

### Hint toast
First launch: shows Vietnamese hint for 3s (stored in `SecureStore` key `capture.hint_seen`).

### AppState
If app backgrounds during recording, `stopRecording()` is called automatically.

## Files
`mobile/src/components/tabs/CameraPage.tsx`
