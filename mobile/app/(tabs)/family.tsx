import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useMembers } from '@/hooks/useMembers';
import { MemberList } from '@/components/family/MemberList';
import { InviteSheet } from '@/components/family/InviteSheet';
import { QRSheet } from '@/components/family/QRSheet';
import { HeaderGradient } from '@/components/ui/HeaderGradient';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { colors, spacing, typography } from '@/constants/theme';

export default function FamilyTab() {
  const { data: members, isLoading } = useMembers();
  const [inviteVisible, setInviteVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  return (
    <View style={styles.container}>
      <HeaderGradient>
        <Text style={styles.heading}>Family 👨‍👩‍👧</Text>
      </HeaderGradient>

      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title="Members" />
        {isLoading && <LoadingSpinner />}
        {members && <MemberList members={members} />}

        <SectionHeader title="Invite Family" />
        <View style={styles.actions}>
          <Button label="Copy Invite Link" onPress={() => setInviteVisible(true)} fullWidth />
          <Button label="Scan QR Code" onPress={() => setQrVisible(true)} variant="ghost" fullWidth />
        </View>
      </ScrollView>

      <InviteSheet visible={inviteVisible} onClose={() => setInviteVisible(false)} />
      <QRSheet visible={qrVisible} onClose={() => setQrVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading:   { ...typography.heading, color: colors.white },
  content:   { padding: spacing['2xl'] },
  actions:   { gap: spacing.md, marginTop: spacing.sm },
});
