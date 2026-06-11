import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { UsersThree, UserPlus, PencilSimple, Archive, Trash, SignOut } from 'phosphor-react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { StickerCard } from '@/components/ui/StickerCard';
import { useAlbumStore } from '@/stores/albumStore';
import { theme, spacing, typography } from '@/constants/theme';
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

type IconBgKey = 'accent1' | 'accent2' | 'accent3' | 'accent4';

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
        <MenuItem
          icon={<PencilSimple size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent1"
          label={t('album_menu.rename')}
          onPress={onRename}
        />
      )}
      <MenuItem
        icon={<UsersThree size={14} color={theme.colors.textPrimary} weight="bold" />}
        bg="accent2"
        label={t('album_menu.members')}
        onPress={onOpenMembers}
      />
      {isAdmin && !isPrivate && !isArchived && (
        <MenuItem
          icon={<UserPlus size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent3"
          label={t('album_menu.invite')}
          onPress={onOpenInvite}
        />
      )}
      {!isAdmin && (
        <MenuItem
          icon={<SignOut size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent4"
          label={t('album_menu.leave_album')}
          onPress={onLeave}
        />
      )}
      {isAdmin && !isArchived && (
        <MenuItem
          icon={<Archive size={14} color={theme.colors.textPrimary} weight="bold" />}
          bg="accent4"
          label={t('album_menu.archive')}
          onPress={onArchive}
        />
      )}
      {isAdmin && (
        <MenuItem
          icon={<Trash size={14} color={theme.colors.textOnPrimary} weight="bold" />}
          bg="accent1"
          label={t('album_menu.delete_album')}
          onPress={onDelete}
          danger
        />
      )}
    </SheetModal>
  );
}

function MenuItem({ icon, bg, label, onPress, danger }: {
  icon: React.ReactNode;
  bg: IconBgKey;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <StickerCard style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: danger ? theme.colors.error : theme.colors[bg] }]}>
          {icon}
        </View>
        <Text style={[styles.label, danger && styles.dangerLabel]}>{label}</Text>
      </StickerCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconWrap:    { width: 28, height: 28, borderRadius: theme.radii.sm, borderWidth: theme.border.thin, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  label:       { ...typography.body, color: theme.colors.textPrimary, flex: 1 },
  dangerLabel: { color: theme.colors.error },
});
