import React from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneCard } from '@/components/ui/MilestoneCard';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, shadows, spacing, typography } from '@/constants/theme';

export default function MilestonesTab() {
  const { data: milestones, isLoading } = useMilestones();

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.heading}>Moments 🌟</Text>
      </HeaderGradient>

      {isLoading && <LoadingSpinner />}
      {!isLoading && !milestones?.length && (
        <EmptyState emoji="🌟" message="No moments yet! Tap ➕ to record your first milestone." />
      )}
      {!isLoading && milestones && milestones.length > 0 && (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <MilestoneCard
              title={item.title}
              note={item.note}
              occurredAt={item.occurred_at}
              onPress={() => router.push(`/milestone/${item.id}`)}
            />
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/milestone/new')}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  heading:   { ...typography.heading, color: colors.white },
  list:      { padding: spacing['2xl'] },
  fab: {
    position: 'absolute', bottom: 90, right: spacing['2xl'],
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.pink,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.fab,
  },
});
