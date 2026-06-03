import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, SafeAreaView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { success } from '@/lib/haptics';

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function InviteSheet({ visible, onClose }: InviteSheetProps) {
  const albumId = useAlbumStore((s) => s.albumId);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  async function handleCopyLink() {
    setLoading(true);
    try {
      const { data } = await api.post(`/albums/${albumId}/invites`);
      const generated = `familyguy://join/${data.token}`;
      setLink(generated);
      await Clipboard.setStringAsync(generated);
      success();
      Alert.alert(t('invite.copied'), t('invite.copied_body'));
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.handle} />
        <Text style={styles.eyebrow}>{t('invite.sheet_eyebrow')}</Text>
        <Text style={styles.heading}>{t('family.invite_title')}</Text>

        <Card style={styles.linkCard}>
          <Text style={styles.linkLabel}>{t('invite.link_label')}</Text>
          <Text style={styles.linkValue} numberOfLines={1}>{link ?? '—'}</Text>
        </Card>

        <Text style={styles.expires}>{t('invite.expires')}</Text>

        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Button label={t('family.copy_link')} onPress={handleCopyLink} fullWidth loading={loading} />
          <Button label={t('common.done')}      onPress={onClose} variant="ghost" fullWidth />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, padding: spacing['2xl'], backgroundColor: colors.cream, gap: spacing.sm },
  handle:     { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.inkMuted, marginBottom: spacing.md },
  eyebrow:    { ...typography.handAccent, color: colors.pink },
  heading:    { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
  linkCard:   { gap: 4 },
  linkLabel:  { ...typography.caption },
  linkValue:  { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: colors.inkSoft },
  expires:    { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm },
});
