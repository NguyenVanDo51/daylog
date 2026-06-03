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
        placeholderTextColor={colors.inkMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label:   { ...typography.body, marginBottom: spacing.xs, color: colors.inkSoft },
  input: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.bodySmall,
    color: colors.ink,
  },
  focused: { borderColor: colors.pink },
});
