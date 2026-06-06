import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SheetModal } from '@/components/ui/SheetModal';
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible || !albumId) return;
    setLink(null);
    setCopied(false);
    setLoading(true);
    api.post(`/albums/${albumId}/invites`)
      .then(({ data }) => setLink(`familyguy://join/${data.token}`))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, albumId]);

  async function handleCopyLink() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    success();
    setCopied(true);
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <Text style={styles.eyebrow}>{t('invite.sheet_eyebrow')}</Text>
      <Text style={styles.heading}>{t('family.invite_title')}</Text>

      <Card style={styles.linkCard}>
        <Text style={styles.linkLabel}>{t('invite.link_label')}</Text>
        <Text style={styles.linkValue} numberOfLines={1}>{loading ? '...' : (link ?? '—')}</Text>
      </Card>

      <Text style={styles.expires}>{t('invite.expires')}</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        <Button label={copied ? t('invite.copied') : t('family.copy_link')} onPress={handleCopyLink} fullWidth loading={loading} disabled={!link} />
        <Button label={t('common.done')}      onPress={onClose} variant="ghost" fullWidth />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  eyebrow:   { ...typography.handAccent, color: colors.pink },
  heading:   { ...typography.heading, color: colors.ink, marginBottom: spacing.md },
  linkCard:  { gap: 4 },
  linkLabel: { ...typography.caption },
  linkValue: { fontFamily: 'Fredoka_500Medium', fontSize: 14, color: colors.inkSoft },
  expires:   { fontFamily: 'Caveat_500Medium', fontSize: 14, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.sm },
});
