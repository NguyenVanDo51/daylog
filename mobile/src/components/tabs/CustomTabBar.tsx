import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';

interface Props {
  activePage: number;
  onTabPress: (index: number) => void;
}

export function CustomTabBar({ activePage, onTabPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.sm }]}>
      <TouchableOpacity
        testID="tab-camera"
        style={styles.tab}
        onPress={() => onTabPress(0)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activePage === 0 ? 'camera' : 'camera-outline'}
          size={26}
          color={activePage === 0 ? colors.pink : colors.inkMuted}
        />
      </TouchableOpacity>
      <TouchableOpacity
        testID="tab-albums"
        style={styles.tab}
        onPress={() => onTabPress(1)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={activePage === 1 ? 'images' : 'images-outline'}
          size={26}
          color={activePage === 1 ? colors.pink : colors.inkMuted}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
