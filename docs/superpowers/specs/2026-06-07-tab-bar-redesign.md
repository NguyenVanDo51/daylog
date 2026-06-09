# Tab Bar — CustomTabBar Component

**Date:** 2026-06-07  
**Updated:** 2026-06-09 (reflect actual implementation)  
**Status:** Component built, not rendered

## Current State

`CustomTabBar` component is fully implemented at `mobile/src/components/tabs/CustomTabBar.tsx` but is **not rendered** in `app/(tabs)/index.tsx`. Navigation between camera and albums is swipe-only via PagerView.

`(tabs)/index.tsx` structure:
```tsx
<View style={styles.root}>
  <PagerView initialPage={1} onPageSelected={...}>
    <View key="0"><CameraPage onTabPress={goToPage} /></View>
    <View key="1"><AlbumsPage onCameraPress={() => goToPage(0)} /></View>
  </PagerView>
  {/* No CustomTabBar rendered */}
</View>
```

## Component Spec (implemented, matches code)

File: `mobile/src/components/tabs/CustomTabBar.tsx`

### Container
| Property | Value |
|---|---|
| Shape | `borderRadius: 9999` (pill) |
| Background | `colors.white` |
| Border | `2px solid colors.ink` |
| Shadow | `shadowOffset: {3,3}`, `shadowColor: colors.ink`, `shadowOpacity: 1`, `shadowRadius: 0` |
| Horizontal margin | `marginHorizontal: spacing.lg` |
| Bottom offset | `bottom: insets.bottom + 12` |
| Position | `absolute` |
| Inner padding | `PADDING = 5` |
| Gap between tabs | `GAP = 4` |

### Active tab (sliding pill)
| Property | Value |
|---|---|
| Background | `colors.pink` |
| Shadow | `shadowOffset: {2,2}`, `shadowColor: colors.pinkDeep`, `shadowOpacity: 1`, `shadowRadius: 0` |
| Text color | `colors.white` |
| Border radius | `9999` |

### Inactive tab
| Property | Value |
|---|---|
| Background | `transparent` |
| Text color | `colors.inkMuted` |

### Typography
| Property | Value |
|---|---|
| Font family | `fonts.semiBold` (Caveat_600SemiBold) |
| Font size | `17` |
| Tab 0 label | `"Chụp ảnh"` |
| Tab 1 label | `"Nhật ký"` |

### Animation
Single `Animated.View` sliding pill using `Animated.spring()` with `stiffness: 200, damping: 20, useNativeDriver: true`. Position snaps immediately on first layout.

## Props
```ts
interface Props {
  activePage: number;
  onTabPress: (index: number) => void;
}
```
