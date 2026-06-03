import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface LabeledTextInputProps extends TextInputProps {
  label?: string;
}

export function TextInput({ label, style, ...props }: LabeledTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[styles.input, focused && styles.focused, style]}
        placeholderTextColor={colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label:   { ...typography.subheading, marginBottom: spacing.xs, color: colors.textSecondary },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.textPrimary,
  },
  focused: { borderColor: colors.primary },
});
