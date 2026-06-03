import React, { useState } from 'react';
import { Text, Alert, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { SheetModal } from '@/components/ui/SheetModal';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, typography } from '@/constants/theme';

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
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.heading}>Invite Family 👨‍👩‍👧</Text>
      <Text style={styles.body}>Share an invite link so family members can join the album.</Text>
      <Button label="Copy Invite Link" onPress={handleCopyLink} fullWidth loading={loading} />
      <Button label="Done" onPress={onClose} variant="ghost" fullWidth />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.textPrimary },
  body:    { ...typography.body, color: colors.textSecondary },
});
