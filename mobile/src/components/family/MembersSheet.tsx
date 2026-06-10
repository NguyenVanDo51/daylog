import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { MemberList } from '@/components/family/MemberList';
import { useMembers } from '@/hooks/useMembers';
import { colors, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

interface MembersSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function MembersSheet({ visible, onClose }: MembersSheetProps) {
  const { data: members = [] } = useMembers();
  return (
    <SheetModal visible={visible} onClose={onClose} size="large">
      <Text style={styles.heading}>{t('album_menu.members_title')}</Text>
      <MemberList members={members} />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, color: colors.ink },
});
