import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCreateMilestone } from '@/hooks/useMilestones';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function NewMilestoneScreen() {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { mutateAsync, isPending } = useCreateMilestone();

  async function handleSave() {
    if (!title.trim()) { Alert.alert(t('milestone.name_ph')); return; }
    await mutateAsync({ title: title.trim(), note: note.trim() || undefined, occurred_at: date });
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.handle} />
      <Text style={styles.eyebrow}>{t('milestone.new_eyebrow')}</Text>
      <Text style={styles.heading}>{t('milestone.new_title')}</Text>

      <TextInput placeholder={t('milestone.name_ph')} value={title} onChangeText={setTitle} />
      <TextInput placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
      <TextInput
        placeholder={t('milestone.note_ph')}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={4}
        caveatPlaceholder
        style={{ height: 100, textAlignVertical: 'top' }}
      />

      <Button label={t('milestone.save')} onPress={handleSave} fullWidth loading={isPending} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  content:   { padding: spacing['2xl'], gap: spacing.sm },
  handle:    { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:   { ...typography.handAccent, color: colors.pink },
  heading:   { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
});
