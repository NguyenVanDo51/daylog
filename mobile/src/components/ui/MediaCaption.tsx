import React from 'react';
import { View, Text, TextInput, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import { OutlinedText } from '@/components/ui/OutlinedText';

interface Props {
  time: string;
  caption?: React.ReactNode;
  editable?: boolean;
  onCaptionChange?: (v: string) => void;
  placeholder?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function MediaCaption({
  time,
  caption,
  editable = false,
  onCaptionChange,
  placeholder,
  testID,
  style,
}: Props) {
  return (
    <View
      style={[styles.container, style]}
      pointerEvents={editable ? 'box-none' : 'none'}
      testID={!editable ? testID : undefined}
    >
      <View style={styles.timeRow}>
        <OutlinedText size={20} testID="media-caption-time">{time}</OutlinedText>
      </View>

      <View style={styles.captionContainer}>
        {editable ? (
          <TextInput
            testID={testID}
            style={[styles.caption, styles.captionInput]}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.55)"
            value={typeof caption === 'string' ? caption : ''}
            onChangeText={onCaptionChange ?? (() => { })}
            multiline
            maxLength={50}
            textAlign="center"
          />
        ) : (
          <Text testID="media-caption-text" style={[styles.caption, styles.captionText]}>{caption ?? ''}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  timeRow: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  captionContainer: {
    height: 60,
    textAlignVertical: 'top',
  },
  caption: {
    ...typography.body,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
    fontSize: 18,
  },
  captionInput: {
    alignSelf: 'stretch',
  },
  captionText: {
    textAlign: 'center',
  },
});
