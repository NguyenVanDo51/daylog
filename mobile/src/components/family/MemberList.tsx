import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import type { Member } from '@/hooks/useMembers';
import { colors, spacing, typography } from '@/constants/theme';

export function MemberList({ members }: { members: Member[] }) {
  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      scrollEnabled={false}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Avatar uri={item.avatar_url} name={item.display_name} size={40} />
          <View style={styles.info}>
            <Text style={styles.name}>{item.display_name}</Text>
            <Text style={styles.joined}>Joined {new Date(item.joined_at).toLocaleDateString()}</Text>
          </View>
          <Badge label={item.role} variant={item.role === 'admin' ? 'primary' : 'surface'} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  info:   { flex: 1 },
  name:   { ...typography.subheading, color: colors.textPrimary },
  joined: { ...typography.caption, color: colors.textMuted },
});
