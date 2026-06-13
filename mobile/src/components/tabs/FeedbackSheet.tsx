import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import Constants from 'expo-constants';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerButton } from '@/components/ui/StickerButton';
import { api } from '@/lib/api';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

type Rating = 1 | 2 | 3 | 4 | 5;
const EMOJIS: Record<Rating, string> = { 1: '😡', 2: '😟', 3: '😐', 4: '🙂', 5: '🤩' };
const RATINGS: Rating[] = [1, 2, 3, 4, 5];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function FeedbackSheet({ visible, onClose }: Props) {
  const [rating, setRating] = useState<Rating | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRating(null);
      setMessage('');
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  const ratingLabel = rating ? t(`feedback.rating.${rating}`) : ' ';

  async function handleSubmit() {
    if (rating === null) return;
    const trimmed = message.trim();
    const payload: Record<string, unknown> = {
      rating,
      app_version: Constants.expoConfig?.version ?? null,
      platform: Platform.OS,
    };
    if (trimmed.length > 0) payload.message = trimmed;
    if (payload.app_version === null) delete payload.app_version;

    setSubmitting(true);
    setError(null);
    try {
      await api.post('/feedback', payload);
      Alert.alert('', t('feedback.success'));
      onClose();
    } catch {
      setError(t('feedback.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.title}>{t('feedback.title')}</Text>

      <View style={styles.emojiRow}>
        {RATINGS.map((r) => {
          const selected = rating === r;
          return (
            <TouchableOpacity
              key={r}
              testID={`feedback-rating-${r}`}
              onPress={() => setRating(r)}
              activeOpacity={0.7}
              style={[styles.emojiBtn, selected && styles.emojiBtnSelected]}
            >
              <Text style={[styles.emoji, !selected && styles.emojiDimmed]}>{EMOJIS[r]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.ratingLabel}>{ratingLabel}</Text>

      <TextInput
        testID="feedback-message"
        style={styles.input}
        placeholder={t('feedback.message_placeholder')}
        placeholderTextColor={theme.colors.textMuted}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={2000}
        textAlignVertical="top"
      />

      <StickerButton
        label={t('feedback.submit')}
        variant="primary"
        fullWidth
        disabled={rating === null}
        loading={submitting}
        onPress={handleSubmit}
        testID="feedback-submit"
      />

      {error && <Text style={styles.error}>{error}</Text>}
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  title:            { ...typography.title, color: theme.colors.textPrimary, textAlign: 'center' },
  emojiRow:         { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: spacing.sm },
  emojiBtn:         { padding: spacing.xs, borderRadius: theme.radii.md },
  emojiBtnSelected: { backgroundColor: theme.colors.accent2, transform: [{ scale: 1.1 }] },
  emoji:            { fontSize: 32 },
  emojiDimmed:      { opacity: 0.6 },
  ratingLabel:      { ...typography.bodySmall, color: theme.colors.textSecondary, textAlign: 'center', minHeight: 18 },
  input:            { ...typography.body, color: theme.colors.textPrimary, borderWidth: theme.border.thin, borderColor: theme.colors.border, borderRadius: theme.radii.md, padding: spacing.md, minHeight: 96 },
  error:            { ...typography.bodySmall, color: theme.colors.error, textAlign: 'center' },
});
