import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const [loading, setLoading] = useState(false);

  async function handleCopyLink() {
    setLoading(true);
    try {
      const { data } = await api.post(`/albums/${albumId}/invites`);
      const link = `familyguy://join/${data.token}`;
      await Clipboard.setStringAsync(link);
      Alert.alert('Copied!', 'Invite link copied to clipboard.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <Text style={styles.heading}>Invite Family 👨‍👩‍👧</Text>
        <Text style={styles.body}>Share an invite link so family members can join the album.</Text>
        <Button label="Copy Invite Link" onPress={handleCopyLink} fullWidth loading={loading} />
        <Button label="Done" onPress={onClose} variant="ghost" fullWidth />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing['2xl'], backgroundColor: colors.background, gap: spacing.md },
  heading:   { ...typography.heading, color: colors.textPrimary },
  body:      { ...typography.body, color: colors.textSecondary },
});
