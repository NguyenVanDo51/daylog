import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Member } from '@/hooks/useMembers';
import { colors, fonts, radii, shadows, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate, formatVnMonth } from '@/lib/format';

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar src={item.avatar_url} size={40} bgColor="accent1" />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>
              {t('family.joined_on', { date: `${formatVnDate(new Date(item.joined_at))} ${formatVnMonth(new Date(item.joined_at))}` })}
            </Text>
          </View>
          <Badge
            label={item.role === 'admin' ? t('family.role_admin') : t('family.role_member')}
            color={item.role === 'admin' ? 'yellow' : 'mint'}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.md,
    marginVertical: spacing.xs, gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radii.md,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink, ...shadows.sticker,
  },
  info:   { flex: 1 },
  name:   { ...typography.title, color: colors.ink },
  joined: { fontFamily: fonts.medium, fontSize: 14, color: colors.inkMuted },
});
