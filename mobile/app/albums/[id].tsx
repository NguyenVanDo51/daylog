import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TimelineFeed } from '@/components/timeline/TimelineFeed';
import { useUploadSheetStore } from '@/stores/uploadSheetStore';
import { tap } from '@/lib/haptics';
import { colors, shadows, spacing } from '@/constants/theme';

export default function AlbumScreen() {
  const insets = useSafeAreaInsets();
  const openUpload = useUploadSheetStore((s) => s.open);

  function handleFab() {
    tap();
    openUpload();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TimelineFeed onJumpToDay={() => {}} />
      <TouchableOpacity
        testID="timeline-upload-fab"
        onPress={handleFab}
        activeOpacity={0.85}
        style={[styles.fabWrap, { bottom: spacing['2xl'] + insets.bottom }]}
      >
        <LinearGradient
          colors={[colors.peach, colors.pink]}
          style={styles.fab}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="add" size={26} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  fabWrap: {
    position: 'absolute',
    right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.fab,
  },
  fab: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
  },
});
