import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useCreateMilestone } from '@/hooks/useMilestones';
import { TextInput } from '@/components/ui/TextInput';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';

export default function NewMilestoneScreen() {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const { mutateAsync, isPending } = useCreateMilestone();

  async function handleSave() {
    if (!title.trim()) { Alert.alert('Title required'); return; }
    await mutateAsync({ title: title.trim(), note: note.trim() || undefined, occurred_at: date });
    router.back();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>New Moment 🌟</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.cancel}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.form}>
        <TextInput label="Title *" placeholder="e.g. First Steps!" value={title} onChangeText={setTitle} />
        <TextInput label="Date" placeholder="YYYY-MM-DD" value={date} onChangeText={setDate} />
        <TextInput
          label="Note"
          placeholder="Tell the story..."
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={4}
          style={{ height: 100, textAlignVertical: 'top' }}
        />
        <Button label="Save Moment" onPress={handleSave} fullWidth loading={isPending} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing['2xl'], paddingTop: spacing['4xl'] },
  heading:   { ...typography.title, color: colors.textPrimary },
  cancel:    { ...typography.subheading, color: colors.primary },
  form:      { padding: spacing['2xl'], gap: spacing.md },
});
