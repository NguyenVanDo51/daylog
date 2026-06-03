import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, useWindowDimensions, StatusBar } from 'react-native';
import Animated from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTimeline } from '@/hooks/useTimeline';
import { colors, spacing, typography } from '@/constants/theme';
import { useSharedTransition } from '@/lib/sharedElement';
import { t } from '@/lib/i18n';
import { formatVnDate } from '@/lib/format';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function PhotoViewer() {
  const params = useLocalSearchParams<{ id: string; srcX?: string; srcY?: string; srcW?: string; srcH?: string }>();
  const { data } = useTimeline();
  const photos = (data?.pages.flatMap((p) => p.items) ?? []).filter((i: any) => i.type === 'photo');
  const idx    = photos.findIndex((p: any) => p.id === params.id);
  const photo  = photos[idx];
  const { width, height } = useWindowDimensions();

  const source = (params.srcX && params.srcY && params.srcW && params.srcH) ? {
    x: Number(params.srcX), y: Number(params.srcY), width: Number(params.srcW), height: Number(params.srcH),
  } : null;
  const style = useSharedTransition(source, width, height, true);

  if (!photo) return null;
  const taken = (photo as any).taken_at as string;
  const counter = t('photo.counter', { i: idx + 1, n: photos.length });

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.Image source={{ uri: `${API_URL}/photos/${photo.id}/full` }} style={[style]} resizeMode="contain" />

      <BlurView intensity={30} tint="dark" style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.meta}>{counter} · {formatVnDate(new Date(taken))}</Text>
        <View style={styles.iconBtn} />
      </BlurView>

      {(photo as any).caption && (
        <Text style={styles.caption}>{(photo as any).caption}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A1A' },
  topBar:    { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta:      { ...typography.bodySmall, color: colors.white },
  iconBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  caption:   { ...typography.handAccent, color: colors.white, fontSize: 18, position: 'absolute', bottom: 60, left: spacing.lg, right: spacing.lg, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
});
