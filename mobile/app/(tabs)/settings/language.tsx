import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { CaretLeft, Check } from 'phosphor-react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '@/constants/theme';
import { t, setLanguage, getCurrentLanguage, AppLanguage } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';

const OPTIONS: { value: AppLanguage; labelKey: string }[] = [
  { value: 'device', labelKey: 'language.device' },
  { value: 'vi',     labelKey: 'language.vi' },
  { value: 'en',     labelKey: 'language.en' },
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
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('language.title')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        <Card tier="quiet" style={styles.section}>
          {OPTIONS.map((opt, i) => (
            <View key={opt.value}>
              {i > 0 && <View style={styles.divider} />}
              <TouchableOpacity style={styles.row} onPress={() => select(opt.value)}>
                <Text style={styles.rowLabel}>{t(opt.labelKey)}</Text>
                {current === opt.value && <Check size={20} color={colors.pink} weight="bold" />}
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: colors.cream },
  headerRow:  { flexDirection: 'row', alignItems: 'center' },
  backBtn:    { width: 32 },
  heading:    { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:    { padding: spacing['2xl'], gap: spacing.md },
  section:    { gap: spacing.md },
  row:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  rowLabel:   { ...typography.body, color: colors.ink },
  divider:    { height: 1, backgroundColor: colors.borderSoft },
});
