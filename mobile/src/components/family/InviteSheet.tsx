import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';
import { theme, spacing, typography } from '@/constants/theme';
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
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible || !albumId) return;
    setLink(null);
    setQrCode(null);
    setCopied(false);
    setLoading(true);
    api.post(`/albums/${albumId}/invites`)
      .then(({ data }) => {
        setLink(`familyguy://join/${data.token}`);
        setQrCode(data.qr_code ?? null);
      })
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
      <Text style={styles.heading}>{t('family.invite_title')}</Text>

      <StickerCard style={styles.linkCard}>
        <Text style={styles.linkLabel}>{t('invite.link_label')}</Text>
        <Text style={styles.linkValue} numberOfLines={1}>{loading ? '...' : (link ?? '—')}</Text>
      </StickerCard>

      {qrCode && (
        <StickerCard style={styles.qrCard}>
          <Image source={{ uri: qrCode }} style={styles.qr} />
        </StickerCard>
      )}

      <Text style={styles.expires}>{t('invite.expires')}</Text>

      <View style={styles.buttons}>
        <StickerButton
          label={copied ? t('invite.copied') : t('family.copy_link')}
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!link}
          onPress={handleCopyLink}
        />
        <StickerButton
          label={t('common.done')}
          variant="surface"
          fullWidth
          onPress={onClose}
        />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading:   { ...typography.displayCute, fontSize: 20, color: theme.colors.textPrimary, textAlign: 'center', marginBottom: spacing.sm },
  linkCard:  { padding: spacing.md, gap: spacing.xs },
  linkLabel: { ...typography.caption, color: theme.colors.textMuted },
  linkValue: { ...typography.body, color: theme.colors.textSecondary, fontFamily: theme.fonts.medium },
  qrCard:    { alignSelf: 'center', padding: spacing.sm },
  qr:        { width: 180, height: 180 },
  expires:   { ...typography.body, color: theme.colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  buttons:   { gap: spacing.md, marginTop: spacing.lg },
});
