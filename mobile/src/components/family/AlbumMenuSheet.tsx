import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus, PencilSimple, Archive, Trash, SignOut } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAlbumStore } from '@/stores/albumStore';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface AlbumMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenMembers: () => void;
  onOpenInvite: () => void;
  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

export function AlbumMenuSheet({
  visible, onClose, onOpenMembers, onOpenInvite,
  onRename, onArchive, onDelete, onLeave,
}: AlbumMenuSheetProps) {
  const isPrivate  = useAlbumStore((s) => s.isPrivate);
  const myRole     = useAlbumStore((s) => s.myRole);
  const archivedAt = useAlbumStore((s) => s.archivedAt);
  const isArchived = archivedAt !== null;
  const isAdmin    = myRole === 'admin';

  return (
    <SheetModal visible={visible} onClose={onClose}>
      {isAdmin && !isArchived && (
        <MenuItem icon={<PencilSimple size={22} color={colors.ink} />} label={t('album_menu.rename')} onPress={onRename} />
      )}
      <MenuItem icon={<UsersThree size={22} color={colors.ink} />} label={t('album_menu.members')} onPress={onOpenMembers} />
      {isAdmin && !isPrivate && !isArchived && (
        <MenuItem icon={<UserPlus size={22} color={colors.ink} />} label={t('album_menu.invite')} onPress={onOpenInvite} />
      )}
      {!isAdmin && (
        <MenuItem icon={<SignOut size={22} color={colors.ink} />} label={t('album_menu.leave_album')} onPress={onLeave} />
      )}
      {isAdmin && !isArchived && (
        <MenuItem icon={<Archive size={22} color={colors.ink} />} label={t('album_menu.archive')} onPress={onArchive} />
      )}
      {isAdmin && (
        <MenuItem icon={<Trash size={22} color={colors.error} />} label={t('album_menu.delete_album')} onPress={onDelete} danger />
      )}
    </SheetModal>
  );
}

function MenuItem({ icon, label, onPress, danger }: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  label:       { ...typography.body, color: colors.ink },
  dangerLabel: { color: colors.error },
});
