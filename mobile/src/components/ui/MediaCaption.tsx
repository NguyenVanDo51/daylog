import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { PlayIcon, PauseIcon } from 'phosphor-react-native';
import { colors, fonts, spacing } from '@/constants/theme';

interface Props {
  time: string;
  caption?: string;
  editable?: boolean;
  onCaptionChange?: (v: string) => void;
  showPlayIcon?: boolean;
  isPaused?: boolean;
  testID?: string;
}

export function MediaCaption({
  time,
  caption,
  editable = false,
  onCaptionChange,
  showPlayIcon = false,
  isPaused = false,
  testID,
}: Props) {
  return (
    <View
      style={styles.container}
      pointerEvents={editable ? 'box-none' : 'none'}
      testID={!editable ? testID : undefined}
    >
      <View style={styles.timeRow}>
        {showPlayIcon && (
          isPaused
            ? <PauseIcon size={16} color={colors.pink} weight="fill" />
            : <PlayIcon size={16} color={colors.pink} weight="fill" />
        )}
        <Text testID="media-caption-time" style={styles.time}>{time}</Text>
      </View>
      {editable ? (
        <>
          <TextInput
            testID={testID}
            style={styles.captionInput}
            placeholder="Thêm ghi chú..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={caption}
            onChangeText={onCaptionChange ?? (() => {})}
            multiline
            maxLength={200}
            autoFocus
            textAlign="center"
            selectionColor={colors.pink}
          />
          <View style={styles.captionUnderline} />
        </>
      ) : caption ? (
        <Text testID="media-caption-text" style={styles.captionText}>{caption}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  time: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.pink,
    letterSpacing: 1,
    textShadowColor: 'rgba(255,122,168,0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  captionText: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.white,
    fontStyle: 'italic',
    lineHeight: 26,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  captionInput: {
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
    width: '82%',
    textAlign: 'center',
  },
  captionUnderline: {
    width: 50,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 1,
    marginTop: 6,
  },
});
