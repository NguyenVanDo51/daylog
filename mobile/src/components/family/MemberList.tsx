import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerChip } from '@/components/ui/StickerChip';
import type { Member } from '@/hooks/useMembers';
import { theme, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';
import { formatVnDate, formatVnMonth } from '@/lib/format';

const ACCENT_KEYS = ['accent1', 'accent2', 'accent3', 'accent4'] as const;

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      contentContainerStyle={{ gap: spacing.sm }}
      renderItem={({ item, index }) => (
        <StickerCard style={styles.row}>
          <Avatar src={item.avatar_url} size={40} bgColor={ACCENT_KEYS[index % ACCENT_KEYS.length]} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>
              {t('family.joined_on', { date: `${formatVnDate(new Date(item.joined_at))} ${formatVnMonth(new Date(item.joined_at))}` })}
            </Text>
          </View>
          <StickerChip
            label={item.role === 'admin' ? t('family.role_admin') : t('family.role_member')}
            variant={item.role === 'admin' ? 'yellow' : 'mint'}
          />
        </StickerCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  info:   { flex: 1 },
  name:   { ...typography.title, color: theme.colors.textPrimary },
  joined: { ...typography.bodySmall, color: theme.colors.textMuted },
});
