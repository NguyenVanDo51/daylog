import React, { useState } from 'react';
import { View, TextInput as RNTextInput, Text, StyleSheet, TextInputProps } from 'react-native';
import { colors, radii, spacing, typography } from '@/constants/theme';

interface LabeledTextInputProps extends TextInputProps {
  label?: string;
  caveatPlaceholder?: boolean;
}

export function TextInput({ label, style, caveatPlaceholder, ...props }: LabeledTextInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[
          styles.input,
          caveatPlaceholder && !props.value ? styles.caveatStyle : null,
          focused && styles.focused,
          style,
        ]}
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
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.ink,
  },
  focused:     { borderColor: colors.pink, borderStyle: 'solid' },
  caveatStyle: { fontFamily: 'Caveat_500Medium', fontSize: 16 },
});
