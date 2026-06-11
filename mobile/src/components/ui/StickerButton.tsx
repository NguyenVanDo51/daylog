import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, View, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { theme } from '@/constants/theme';
import { tap } from '@/lib/haptics';

type ButtonVariant = keyof typeof theme.components.stickerButton;

interface StickerButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  shadow?: 'normal' | 'heavy';
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  testID?: string;
}

export function StickerButton({
  label,
  onPress,
  variant = 'primary',
  shadow = 'normal',
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
  testID,
}: StickerButtonProps) {
  const v = theme.components.stickerButton[variant];
  const blocked = disabled || loading;

  const container: ViewStyle = {
    backgroundColor: v.backgroundColor,
    borderColor:     v.borderColor,
    borderWidth:     v.borderWidth,
    borderRadius:    v.borderRadius,
    paddingVertical:   theme.spacing.md,
    paddingHorizontal: theme.spacing['2xl'],
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             theme.spacing.sm,
    ...(shadow === 'heavy' ? theme.shadows.stickerHeavy : v.shadow),
    ...(fullWidth && { alignSelf: 'stretch' }),
    ...(blocked && { opacity: 0.65 }),
  };
  const labelStyle: TextStyle = {
    ...theme.typography.body,
    fontFamily: theme.fonts.semiBold,
    color: v.textColor,
  };

  function handlePress() {
    if (blocked) return;
    tap();
    onPress();
  }

  return (
    <TouchableOpacity
      testID={testID}
      onPress={handlePress}
      disabled={blocked}
      activeOpacity={0.85}
      style={container}
    >
      {loading ? (
        <ActivityIndicator color={v.textColor} />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={labelStyle}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
