import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckIcon, SpeakerSimpleSlashIcon } from 'phosphor-react-native';
import { useSoundtracks } from '@/hooks/useSoundtracks';
import { useSetDaySoundtrack } from '@/hooks/useSetDaySoundtrack';
import { theme, spacing, typography } from '@/constants/theme';
import { StickerCard } from '@/components/ui/StickerCard';

interface Props {
  albumId: string;
  date: string;
  currentSoundtrackId: string | null;
  onClose: () => void;
}

export function SoundtrackPickerSheet({ albumId, date, currentSoundtrackId, onClose }: Props) {
  const { data: tracks, isLoading } = useSoundtracks();
  const mutation = useSetDaySoundtrack(albumId, date);

  async function pick(id: string | null) {
    await mutation.mutateAsync(id);
    onClose();
  }

  return (
    <TouchableOpacity
      style={styles.backdrop}
      activeOpacity={1}
      onPress={onClose}
      testID="soundtrack-picker-backdrop"
    >
      <StickerCard shadow="heavy" style={styles.sheet}>
        <Text style={styles.title}>Nhạc nền cho ngày</Text>
        <ScrollView style={styles.list}>
          <TouchableOpacity
            testID="soundtrack-row-none"
            style={[styles.row, currentSoundtrackId === null && styles.rowSelected]}
            onPress={() => pick(null)}
            disabled={mutation.isPending}
          >
            <SpeakerSimpleSlashIcon size={18} color={theme.colors.textPrimary} />
            <Text style={styles.rowText}>Tắt nhạc</Text>
            {currentSoundtrackId === null && (
              <CheckIcon size={16} color={theme.colors.accent1} weight="bold" />
            )}
          </TouchableOpacity>

          {isLoading && <ActivityIndicator style={{ marginVertical: spacing.md }} />}

          {tracks?.map((t) => {
            const selected = t.id === currentSoundtrackId;
            return (
              <TouchableOpacity
                key={t.id}
                testID={selected ? `soundtrack-row-${t.id}-selected` : `soundtrack-row-${t.id}`}
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => pick(t.id)}
                disabled={mutation.isPending}
              >
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowText}>{t.title}</Text>
                  {t.artist && <Text style={styles.rowMeta}>{t.artist}</Text>}
                </View>
                {selected && (
                  <CheckIcon size={16} color={theme.colors.accent1} weight="bold" />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: spacing.lg, padding: 0, overflow: 'hidden', maxHeight: '70%',
  },
  title: {
    ...typography.title, color: theme.colors.textPrimary,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: theme.border.hairline, borderBottomColor: theme.colors.borderSoft,
  },
  list: { paddingVertical: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  rowSelected: { backgroundColor: theme.overlays.surfaceOnDark },
  rowTextWrap: { flex: 1 },
  rowText: { ...typography.body, color: theme.colors.textPrimary },
  rowMeta: { ...typography.caption, color: theme.colors.textMuted, marginTop: 2 },
});
