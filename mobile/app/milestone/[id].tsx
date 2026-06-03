import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMilestones } from '@/hooks/useMilestones';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { colors, spacing, typography } from '@/constants/theme';

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: milestones, isLoading } = useMilestones();
  const milestone = milestones?.find((m) => m.id === id);

  if (isLoading) return <LoadingSpinner />;
  if (!milestone) return null;

  const date = new Date(milestone.occurred_at).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={colors.pink} />
        </TouchableOpacity>
        <Text style={styles.heading}>Moment</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.icon}>🌟</Text>
        <Text style={styles.title}>{milestone.title}</Text>
        <Text style={styles.date}>{date}</Text>
        {milestone.note && <Text style={styles.note}>{milestone.note}</Text>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing['2xl'], paddingTop: spacing['4xl'] },
  heading:   { ...typography.title, color: colors.ink },
  content:   { padding: spacing['2xl'], alignItems: 'center' },
  icon:      { fontSize: 64, marginBottom: spacing.lg },
  title:     { ...typography.heading, color: colors.ink, textAlign: 'center', marginBottom: spacing.sm },
  date:      { ...typography.body, color: colors.inkSoft, marginBottom: spacing['2xl'] },
  note:      { ...typography.bodySmall, color: colors.inkSoft, lineHeight: 22, textAlign: 'center' },
});
