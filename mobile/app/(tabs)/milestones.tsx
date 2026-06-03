import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { colors, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { tap } from '@/lib/haptics';

export default function MilestonesTab() {
  const { data: milestones, isLoading } = useMilestones();

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.eyebrow}>{t('moments.eyebrow')}</Text>
        <Text style={styles.heading}>{t('moments.title')}</Text>
      </JoyfulHeader>

      {isLoading && (
        <View style={styles.list}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      )}
      {!isLoading && !milestones?.length && (
        <EmptyState emoji="🌟" message={t('moments.empty_message')} />
      )}
      {!isLoading && milestones && milestones.length > 0 && (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <MilestoneCard
              title={item.title}
              note={item.note}
              occurredAt={item.occurred_at}
              index={index}
              onPress={() => router.push(`/milestone/${item.id}`)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => { tap(); router.push('/milestone/new'); }}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  eyebrow:   { ...typography.handAccent, color: colors.pink },
  heading:   { ...typography.heading, color: colors.ink },
  list:      { padding: spacing['2xl'], gap: spacing.sm },
  fab: {
    position: 'absolute', bottom: 90, right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.pink, borderWidth: 2, borderColor: colors.ink,
    alignItems: 'center', justifyContent: 'center', ...shadows.sticker,
  },
});
