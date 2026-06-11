import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CaretLeft, Camera } from 'phosphor-react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { QuietHeader } from '@/components/ui/QuietHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { t } from '@/lib/i18n';

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.display_name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = name !== user?.display_name || pendingKey !== null;

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const { data } = await api.post('/users/me/avatar-presign');
      const { upload_url, key } = data;
      const blob = await (await fetch(asset.uri)).blob();
      await fetch(upload_url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } });
      setPendingKey(key);
      setAvatarUri(asset.uri);
    } catch {
      Alert.alert(t('common.error'), 'Không thể tải ảnh lên.');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!isDirty) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (name !== user?.display_name) body.display_name = name;
      if (pendingKey) body.avatar_url = pendingKey;
      const { data } = await api.patch('/users/me', body);
      updateUser({ display_name: data.display_name, avatar_url: data.avatar_url });
      await SecureStore.setItemAsync('auth_user', JSON.stringify({ ...user, display_name: data.display_name, avatar_url: data.avatar_url }));
      router.back();
    } catch {
      Alert.alert(t('common.error'), 'Không thể lưu thông tin.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <QuietHeader>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <CaretLeft size={24} color={colors.ink} />
          </TouchableOpacity>
          <Text style={styles.heading}>{t('settings.edit_profile')}</Text>
          <View style={styles.backBtn} />
        </View>
      </QuietHeader>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
            <Avatar uri={avatarUri} name={name} size={96} />
            <View style={styles.cameraOverlay}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Camera size={20} color={colors.white} weight="bold" />}
            </View>
          </TouchableOpacity>
        </View>

        <Card tier="quiet" style={styles.section}>
          <Text style={styles.label}>{t('settings.display_name_ph')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.display_name_ph')}
            placeholderTextColor={colors.inkMuted}
            autoCapitalize="words"
          />
        </Card>

        <Button
          label={saving ? '...' : t('settings.save')}
          onPress={save}
          variant="primary"
          fullWidth
          disabled={!isDirty || saving || uploading}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.cream },
  headerRow:     { flexDirection: 'row', alignItems: 'center' },
  backBtn:       { width: 32 },
  heading:       { ...typography.heading, color: colors.ink, flex: 1, textAlign: 'center' },
  content:       { padding: spacing['2xl'], gap: spacing.md, alignItems: 'stretch' },
  avatarWrap:    { alignItems: 'center', marginBottom: spacing.md },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.ink, borderRadius: 999, padding: 6 },
  section:       { gap: spacing.sm },
  label:         { ...typography.caption, color: colors.inkMuted },
  input:         { ...typography.body, color: colors.ink, paddingVertical: spacing.sm },
});
