import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CaretLeft } from 'phosphor-react-native';
import { StickerCard } from '@/components/ui/StickerCard';
import { theme, spacing, typography } from '@/constants/theme';

interface ScreenHeaderProps {
  onBack?: () => void;
  backTestID?: string;
  title: string | React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ onBack, backTestID, title, right, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} hitSlop={8} testID={backTestID}>
          <StickerCard style={styles.iconBtn}>
            <CaretLeft size={18} color={theme.colors.textPrimary} weight="bold" />
          </StickerCard>
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}

      <View style={styles.center}>
        {typeof title === 'string'
          ? <Text style={styles.heading}>{title}</Text>
          : title}
      </View>

      {right ?? <View style={styles.iconBtn} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { width: 32, height: 32, padding: 0, alignItems: 'center', justifyContent: 'center' },
  center:  { flex: 1, alignItems: 'center' },
  heading: { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center' },
});
