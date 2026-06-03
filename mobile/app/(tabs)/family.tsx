import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useMembers } from '@/hooks/useMembers';
import { MemberList } from '@/components/family/MemberList';
import { InviteSheet } from '@/components/family/InviteSheet';
import { QRSheet } from '@/components/family/QRSheet';
import { JoyfulHeader } from '@/components/ui/JoyfulHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function FamilyTab() {
  const { data: members, isLoading } = useMembers();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={styles.container}>
      <JoyfulHeader>
        <Text style={styles.heading}>{t('family.title')}</Text>
      </JoyfulHeader>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoading && <SkeletonCard />}
        {members && <MemberList members={members} />}

        <Card tier="quiet" style={styles.inviteCard}>
          <Text style={styles.inviteTitle}>{t('family.invite_title')}</Text>
          <View style={styles.actions}>
            <Button label={t('family.copy_link')} onPress={() => setInviteVisible(true)} fullWidth tier="quiet" />
            <Button label={t('family.scan_qr')}   onPress={() => setQrVisible(true)} variant="ghost" tier="quiet" fullWidth />
          </View>
        </Card>
      </ScrollView>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <QRSheet     visible={qrVisible}     onClose={() => setQrVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.cream },
  heading:     { ...typography.heading, color: colors.ink },
  content:     { padding: spacing['2xl'], gap: spacing.md },
  inviteCard:  { marginTop: spacing.lg, gap: spacing.md },
  inviteTitle: { ...typography.title, color: colors.ink },
  actions:     { gap: spacing.md, marginTop: spacing.sm },
});
