import { useSharedValue, useAnimatedStyle, withTiming, interpolate, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

export interface SourceRect {
  x: number; y: number; width: number; height: number;
}

export function useSharedTransition(source: SourceRect | null, screenWidth: number, screenHeight: number, enter = true) {
  const t = useSharedValue(enter ? 0 : 1);

  useEffect(() => {
    t.value = withTiming(enter ? 1 : 0, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [enter, t]);

  return useAnimatedStyle(() => {
    if (!source) return { opacity: t.value };
    return {
      position: 'absolute',
      width:  interpolate(t.value, [0, 1], [source.width,  screenWidth]),
      height: interpolate(t.value, [0, 1], [source.height, screenHeight]),
      left:   interpolate(t.value, [0, 1], [source.x, 0]),
      top:    interpolate(t.value, [0, 1], [source.y, 0]),
    };
  });
}
