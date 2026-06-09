import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, fonts, radii, spacing, shadows, typography } from '@/constants/theme';
import { tap } from '@/lib/haptics';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  tier?: 'joyful' | 'quiet';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({ label, onPress, variant = 'primary', tier = 'joyful', fullWidth, loading, disabled, testID }: ButtonProps) {
  function handlePress() {
    tap();
    onPress();
  }

  const containerStyle: ViewStyle[] = [
    styles.base,
    tier === 'joyful' && variant !== 'ghost' && styles.joyfulShadow,
    variant === 'primary' && styles.primary,
    variant === 'ghost' && (tier === 'joyful' ? styles.ghostJoyful : styles.ghostQuiet),
    variant === 'danger' && styles.danger,
    tier === 'joyful' && variant !== 'ghost' && styles.joyfulBorder,
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity testID={testID} style={containerStyle} onPress={handlePress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? colors.pink : colors.white} />
        : <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base:        { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'], borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  joyfulBorder:{ borderWidth: 1.5, borderColor: colors.ink },
  joyfulShadow:{ ...shadows.sticker },
  primary:     { backgroundColor: colors.pink },
  ghostJoyful: { backgroundColor: 'transparent', borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink },
  ghostQuiet:  { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.pink },
  danger:      { backgroundColor: colors.pinkDeep },
  fullWidth:   { width: '100%' },
  disabled:    { opacity: 0.5 },
  label:       { ...typography.body, fontFamily: fonts.semiBold, color: colors.white },
  ghostLabel:  { color: colors.ink },
  dangerLabel: { color: colors.white },
});
