import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus, QrCode } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface AlbumMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  onOpenQR: () => void;
}

export function AlbumMenuSheet({ visible, onClose, onOpenMembers, onOpenInvite, onOpenQR }: AlbumMenuSheetProps) {
  return (
    <SheetModal visible={visible} onClose={onClose}>
      <MenuItem icon={<UsersThree size={22} color={colors.ink} />} label={t('album_menu.members')} onPress={onOpenMembers} />
      <MenuItem icon={<UserPlus size={22} color={colors.ink} />} label={t('album_menu.invite')}   onPress={onOpenInvite} />
      <MenuItem icon={<QrCode    size={22} color={colors.ink} />} label={t('album_menu.scan_qr')} onPress={onOpenQR} />
    </SheetModal>
  );
}

function MenuItem({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  label: { ...typography.body, color: colors.ink },
});
