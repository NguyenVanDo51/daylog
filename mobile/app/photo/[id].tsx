import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTimeline, TimelinePhoto, TimelineItem } from '@/hooks/useTimeline';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, spacing, typography } from '@/constants/theme';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

const isPhoto = (i: TimelineItem): i is TimelinePhoto => i.type === 'photo';

export default function PhotoViewerScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useTimeline();

  const photos: TimelinePhoto[] = data?.pages.flatMap((p) => p.items).filter(isPhoto) ?? [];
  const initialIndex = photos.findIndex((p) => p.id === id);
  const [currentIndex, setCurrentIndex] = useState(Math.max(initialIndex, 0));

  const current = photos[currentIndex];
  const closeBtn = (
    <TouchableOpacity style={[styles.close, { top: insets.top + spacing.sm }]} onPress={() => router.back()}>
      <Ionicons name="close" size={28} color={colors.white} />
    </TouchableOpacity>
  );

  if (isLoading || photos.length === 0) {
    return (
      <View style={styles.container}>
        {closeBtn}
        <View style={styles.center}>
          {isLoading ? <LoadingSpinner /> : <Text style={styles.empty}>Photo not found</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {closeBtn}

      <FlatList
        data={photos}
        horizontal
        pagingEnabled
        initialScrollIndex={Math.max(initialIndex, 0)}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.page}>
            <Image
              source={{ uri: `${API_URL}/photos/${item.id}/full` }}
              style={styles.photo}
              contentFit="contain"
            />
          </View>
        )}
      />

      {current?.caption && (
        <View style={styles.captionBar}>
          <Text style={styles.caption}>{current.caption}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.black },
  close:      { position: 'absolute', left: spacing['2xl'], zIndex: 10 },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty:      { ...typography.body, color: colors.white },
  page:       { width, justifyContent: 'center', alignItems: 'center' },
  photo:      { width, height: '100%' },
  captionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.lg },
  caption:    { ...typography.body, color: colors.white },
});
