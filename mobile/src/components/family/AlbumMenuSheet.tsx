import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface AlbumMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
}

export function AlbumMenuSheet({ visible, onClose, onOpenMembers, onOpenInvite }: AlbumMenuSheetProps) {
  const isPrivate = useAlbumStore((s) => s.isPrivate);
  return (
    <SheetModal visible={visible} onClose={onClose}>
      <MenuItem icon={<UsersThree size={22} color={colors.ink} />} label={t('album_menu.members')} onPress={onOpenMembers} />
      {!isPrivate && (
        <MenuItem icon={<UserPlus size={22} color={colors.ink} />} label={t('album_menu.invite')} onPress={onOpenInvite} />
      )}
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
