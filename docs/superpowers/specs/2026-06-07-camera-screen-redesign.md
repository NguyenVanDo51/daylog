# Camera Screen Redesign

**Date:** 2026-06-07  
**Status:** Approved

## Summary

Upgrade `CameraPage` to feel like a diary viewfinder: inset bordered frame, live clock overlay, pink close button inside the frame. Remove orientation toggle. Hide the floating pill tab bar while on the camera tab.

## Changes

### 1. Tab bar — hidden on camera tab

**File:** `mobile/app/(tabs)/index.tsx`

Conditionally render `CustomTabBar` only when `activePage !== 0`:

```tsx
{activePage !== 0 && (
  <CustomTabBar activePage={activePage} onTabPress={...} />
)}
```

When the user swipes PagerView to page 0 (camera), the pill disappears. When they swipe to page 1 (albums) or press the close button, it reappears.

### 2. Remove orientation toggle

**File:** `mobile/src/components/tabs/CameraPage.tsx`

- Delete the `toggleOrientation` function, `isLandscape` state, and `ScreenOrientation.lockAsync` call.
- On mount, lock to portrait permanently:

```ts
React.useEffect(() => {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
  return () => { ScreenOrientation.unlockAsync().catch(() => {}); };
}, []);
```

- Remove the orientation `TouchableOpacity` from `topBar`.

### 3. Layout — inset viewfinder with cream surround

**File:** `mobile/src/components/tabs/CameraPage.tsx`

Replace the current full-bleed `CameraView` with an inset layout:

#### Container
- `backgroundColor: colors.cream` (shows above and below viewfinder)
- `flex: 1`

#### Viewfinder wrapper (`styles.viewfinder`)
| Property | Value |
|---|---|
| `position` | `absolute` |
| `top` | `insets.top + spacing.sm` |
| `bottom` | `insets.bottom + spacing['3xl'] + 60` (leaves room for shutter) |
| `left` | `spacing.lg` (16) |
| `right` | `spacing.lg` (16) |
| `borderRadius` | `18` |
| `borderWidth` | `2` |
| `borderColor` | `colors.ink` |
| `shadowColor` | `colors.ink` |
| `shadowOffset` | `{ width: 3, height: 3 }` |
| `shadowOpacity` | `1` |
| `shadowRadius` | `0` |
| `elevation` | `4` |
| `overflow` | `hidden` |

`CameraView` moves inside this wrapper with `StyleSheet.absoluteFill`.

#### Top bar (inside viewfinder, absolutely positioned)
```
position: absolute, top: 10, left: 10, right: 10
flexDirection: row, justifyContent: space-between
zIndex: 10
```

**Left — Close button:**
| Property | Value |
|---|---|
| `width / height` | `32` |
| `borderRadius` | `10` |
| `backgroundColor` | `colors.pink` |
| `borderWidth` | `1.5` |
| `borderColor` | `colors.ink` |
| `shadowOffset` | `{ width: 1, height: 1 }` |
| `shadowColor` | `colors.ink` |
| `shadowOpacity` | `1` |
| `shadowRadius` | `0` |

Icon: `✕` (Text, 14px, white, fontWeight 700). On press: calls `onTabPress(1)` prop (navigates to Albums tab).

**Right — Flip camera button:**  
Same dimensions (32×32, borderRadius 10) but `backgroundColor: rgba(0,0,0,0.4)`, no border. Keeps existing flip logic.

#### Shutter area
Unchanged logic. Positioned absolutely at `bottom: insets.bottom + spacing.lg`, centered. The cream background shows below the viewfinder.

### 4. Live clock overlay (inside viewfinder)

A `View` with `position: absolute, inset: 0` centered (flexDirection column, alignItems center, justifyContent center), `zIndex: 5`. Pass `pointerEvents="none"` as a JSX prop (not in StyleSheet) so touches pass through to the shutter gesture.

#### Time line
| Property | Value |
|---|---|
| `fontFamily` | `Caveat_700Bold` |
| `fontSize` | `42` |
| `color` | `colors.white` |
| `letterSpacing` | `1` |
| `textShadow` | via `shadowColor/Opacity/Radius` — soft black 0.5 opacity |

#### Date line (below time)
| Property | Value |
|---|---|
| `fontFamily` | `Caveat_600SemiBold` |
| `fontSize` | `15` |
| `color` | `rgba(255,255,255,0.6)` |
| `marginTop` | `4` |

#### Format
- Time: `HH:mm` (24h, zero-padded)  
- Date: `thứ X, D tháng M` — using Vietnamese day names array `['chủ nhật','thứ hai','thứ ba','thứ tư','thứ năm','thứ sáu','thứ bảy']`

#### Timer
`setInterval` every 1000ms, stored in a `useRef`, cleared in `useEffect` cleanup.

### 5. Props change — `CameraPage` receives `onTabPress`

`CameraPage` needs to navigate to tab 1 when close is pressed. Add prop:

```ts
interface CameraPageProps {
  onTabPress: (index: number) => void;
}
```

Pass it from `index.tsx`:

```tsx
<CameraPage onTabPress={(i) => pagerRef.current?.setPage(i)} />
```

## Files changed

| File | Change |
|---|---|
| `mobile/app/(tabs)/index.tsx` | Conditionally render tab bar; pass `onTabPress` to `CameraPage` |
| `mobile/src/components/tabs/CameraPage.tsx` | Inset viewfinder, close btn, clock, remove orientation toggle |

## Out of scope

- Landscape mode (removed entirely — always portrait)
- Grid overlay / rule-of-thirds lines
- Clock in Albums tab
