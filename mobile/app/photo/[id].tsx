import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTimeline, TimelinePhoto } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';

const { width } = Dimensions.get('window');
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function PhotoViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useTimeline();

  const photos: TimelinePhoto[] = (data?.pages.flatMap((p) => p.items).filter((i) => i.type === 'photo') as TimelinePhoto[]) ?? [];
  const initialIndex = photos.findIndex((p) => p.id === id);
  const [currentIndex, setCurrentIndex] = useState(Math.max(initialIndex, 0));

  const current = photos[currentIndex];

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.close} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color={colors.white} />
      </TouchableOpacity>

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
  close:      { position: 'absolute', top: 56, left: spacing['2xl'], zIndex: 10 },
  page:       { width, justifyContent: 'center', alignItems: 'center' },
  photo:      { width, height: '100%' },
  captionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: spacing.lg },
  caption:    { ...typography.body, color: colors.white },
});
