import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, shadows } from '@/constants/theme';

const EMOJIS = ['❤️', '😂', '😍', '🥹'] as const;
export type ReactionEmoji = typeof EMOJIS[number];

interface Props {
  visible: boolean;
  onSelect: (emoji: ReactionEmoji) => void;
  onDismiss: () => void;
}

export function ReactionPicker({ visible, onSelect, onDismiss }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.picker}>
          {EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => { onSelect(emoji); onDismiss(); }}
              activeOpacity={0.7}
            >
              <Text style={styles.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  picker:   { flexDirection: 'row', backgroundColor: colors.cream, borderRadius: 32, padding: spacing.md, gap: spacing.sm, ...shadows.sticker },
  emojiBtn: { padding: spacing.sm },
  emoji:    { fontSize: 32 },
});
