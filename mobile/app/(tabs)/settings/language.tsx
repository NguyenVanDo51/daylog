import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { router } from 'expo-router';
import { theme, spacing, typography } from '@/constants/theme';
import { t, setLanguage, getCurrentLanguage, AppLanguage } from '@/lib/i18n';
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
        <Text style={styles.heading}>{t('language.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

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
  header:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn:   { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  heading:   { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, flex: 1, textAlign: 'center' },
  content:   { padding: spacing['2xl'], gap: spacing.md },
  row:       { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  flag:      { fontSize: 22 },
  rowLabel:  { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
});
