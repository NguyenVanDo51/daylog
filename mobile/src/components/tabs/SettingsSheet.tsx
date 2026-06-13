import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Gear, ChatCircleDots } from 'phosphor-react-native';
import { router } from 'expo-router';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenFeedback: () => void;
}

export function SettingsSheet({ visible, onClose, onOpenFeedback }: Props) {
  function handleSettings() {
    onClose();
    router.push('/(tabs)/settings');
  }

  function handleFeedback() {
    onClose();
    onOpenFeedback();
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <TouchableOpacity onPress={handleSettings} testID="menu-settings" activeOpacity={0.7}>
        <StickerCard style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent3 }]}>
            <Gear size={14} color={theme.colors.textPrimary} weight="bold" />
          </View>
          <Text style={styles.label}>{t('settings.title')}</Text>
        </StickerCard>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleFeedback} testID="menu-feedback" activeOpacity={0.7}>
        <StickerCard style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.accent4 }]}>
            <ChatCircleDots size={14} color={theme.colors.textPrimary} weight="bold" />
          </View>
          <Text style={styles.label}>{t('settings.feedback')}</Text>
        </StickerCard>
      </TouchableOpacity>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconWrap: { width: 28, height: 28, borderRadius: theme.radii.sm, borderWidth: theme.border.thin, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  label:    { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
});
