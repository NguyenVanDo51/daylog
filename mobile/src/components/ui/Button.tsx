import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', fullWidth, loading, disabled }: ButtonProps) {
  const containerStyle: ViewStyle[] = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'ghost'   && styles.ghost,
    variant === 'danger'  && styles.danger,
    fullWidth             && styles.fullWidth,
    (disabled || loading) && styles.disabled,
  ].filter(Boolean) as ViewStyle[];

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}>
      {loading
        ? <ActivityIndicator color={variant === 'ghost' ? colors.primary : colors.white} />
        : <Text style={[styles.label, variant === 'ghost' && styles.ghostLabel, variant === 'danger' && styles.dangerLabel]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base:        { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'], borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  primary:     { backgroundColor: colors.primary },
  ghost:       { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger:      { backgroundColor: colors.error },
  fullWidth:   { width: '100%' },
  disabled:    { opacity: 0.5 },
  label:       { ...typography.subheading, color: colors.white, fontWeight: '700' },
  ghostLabel:  { color: colors.primary },
  dangerLabel: { color: colors.white },
});
