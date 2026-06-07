# Tab Bar Redesign — Floating Pill

**Date:** 2026-06-07  
**Status:** Approved

## Summary

Replace the current flat icon-only tab bar with a floating pill-shaped bar. The active tab fills pink with a hard sticker-shadow; inactive tab is muted text. Uses `Caveat_600SemiBold` (already loaded) for a handwritten diary feel. Two tabs: "Chụp ảnh" (camera) and "Nhật ký" (albums).

## Component: `CustomTabBar`

File: `mobile/src/components/tabs/CustomTabBar.tsx`

### Container

| Property | Value |
|---|---|
| Shape | `borderRadius: 9999` (pill) |
| Background | `colors.white` |
| Border | `2px solid colors.ink` (`#3D2A1F`) |
| Shadow | `shadowOffset: {width:3, height:3}`, `shadowColor: colors.ink`, `shadowOpacity: 1`, `shadowRadius: 0`, `elevation: 4` |
| Horizontal margin | `marginHorizontal: spacing.lg` (16px each side) |
| Bottom offset | `bottom: insets.bottom + 12` |
| Position | `absolute`, sits above the screen's bottom edge |
| Inner padding | `padding: 5` |
| Gap between tabs | `gap: 4` |

The bar is positioned absolutely over the screen content. Scrollable content (masonry grid) naturally scrolls under the pill — no `paddingBottom` adjustment needed on the PagerView.

### Active tab

| Property | Value |
|---|---|
| Background | `colors.pink` (`#FF7AA8`) |
| Shadow | `shadowOffset: {width:2, height:2}`, `shadowColor: colors.pinkDeep`, `shadowOpacity: 1`, `shadowRadius: 0` |
| Text color | `colors.white` |
| Border radius | `9999` |

### Inactive tab

| Property | Value |
|---|---|
| Background | `transparent` |
| Text color | `colors.inkMuted` (`#B5A89C`) |

### Typography

| Property | Value |
|---|---|
| Font family | `Caveat_600SemiBold` |
| Font size | `17` |
| Tab 0 label | `"Chụp ảnh"` |
| Tab 1 label | `"Nhật ký"` |

### Touch target

Each tab `paddingVertical: 10`. Total pill height ~46px, satisfying the 44pt minimum.

### Animation

Render a single `Animated.View` as the sliding pill background, positioned absolutely inside the container. Tab labels sit above it in a `flexDirection: row` layout.

- **Mechanism:** `Animated.spring()` on a `translateX` value — runs on the native thread via `useNativeDriver: true`  
- **Spring config:** `stiffness: 200, damping: 20` — slight bounce  
- **Offset math:** measure container width via `onLayout`; tab 0 offset = `0`, tab 1 offset = `(containerWidth - padding*2 - gap) / 2 + gap`  
- Text colors swap immediately on press (no cross-fade — the moving background communicates the change)

## Parent screen changes (`app/(tabs)/index.tsx`)

The floating pill overlaps the bottom of the PagerView. The screen root needs no `paddingBottom` on the PagerView itself — instead `CustomTabBar` is rendered as a sibling with `position: absolute` at the bottom. The `PagerView` already fills `flex: 1`; the pill visually overlaps the last ~58px of content, which is acceptable (masonry grid scrolls under it).

## No new dependencies

`Caveat_600SemiBold` is already loaded via the app's font config. No packages to add.

## Out of scope

- Icon variants (dropped in favor of text-only)
- Dark mode (app is cream/light only)
- Three or more tabs
