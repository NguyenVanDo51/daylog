import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { theme, spacing, typography } from '@/constants/theme';
import { t, setLanguage, getCurrentLanguage, AppLanguage } from '@/lib/i18n';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';

const OPTIONS: { value: AppLanguage; labelKey: string; flag: string }[] = [
  { value: 'device', labelKey: 'language.device', flag: '📱' },
  { value: 'vi',     labelKey: 'language.vi',     flag: '🇻🇳' },
  { value: 'en',     labelKey: 'language.en',     flag: '🇬🇧' },
];

export default function LanguageScreen() {
  const [current, setCurrent] = useState<AppLanguage>('device');

  useEffect(() => { getCurrentLanguage().then(setCurrent); }, []);

  async function select(lang: AppLanguage) {
    await setLanguage(lang);
    setCurrent(lang);
    router.back();
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        onBack={() => router.back()}
        title={t('language.title')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {OPTIONS.map((opt) => {
          const active = current === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => select(opt.value)}>
              <StickerCard style={styles.row}>
                <Text style={styles.flag}>{opt.flag}</Text>
                <Text style={styles.rowLabel}>{t(opt.labelKey)}</Text>
                {active && <StickerChip label="✓" variant="yellow" />}
              </StickerCard>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content:   { padding: spacing['2xl'], gap: spacing.md },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  flag:      { fontSize: 22 },
  rowLabel:  { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
});
