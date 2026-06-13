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
import { colors, fonts, spacing } from '@/constants/theme';

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
          Daylog
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
    fontFamily: fonts.semiBold,
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
