import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { putLocalFile } from '@/lib/uploadFile';
import { Avatar } from '@/components/ui/Avatar';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { StickerCard } from '@/components/ui/StickerCard';
import { StickerButton } from '@/components/ui/StickerButton';
import { theme, spacing, typography } from '@/constants/theme';
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
      await putLocalFile(upload_url, asset.uri, 'image/jpeg');
      setPendingKey(key);
      setAvatarUri(asset.uri);
    } catch (err) {
      console.warn('avatar upload failed', err);
      Alert.alert(t('common.error'), t('settings.avatar_upload_error'));
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
      Alert.alert(t('common.error'), t('settings.save_error'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        onBack={() => router.back()}
        title={t('settings.edit_profile')}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity onPress={pickAvatar} disabled={uploading}>
            <Avatar src={avatarUri} size={96} bgColor="primary" withCameraOverlay />
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="small" color={theme.colors.textOnPrimary} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <StickerCard style={styles.section}>
          <Text style={styles.label}>{t('settings.display_name_ph')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={t('settings.display_name_ph')}
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="words"
          />
        </StickerCard>

        <StickerButton
          label={t('settings.save')}
          variant="primary"
          fullWidth
          loading={saving}
          disabled={!isDirty || uploading}
          onPress={save}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: theme.colors.background },
  content:          { padding: spacing['2xl'], gap: spacing.lg, alignItems: 'stretch' },
  avatarWrap:       { alignItems: 'center', marginBottom: spacing.md },
  uploadingOverlay: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.overlays.scrim,
    borderRadius: 48,
  },
  section:          { gap: spacing.sm, padding: spacing.md },
  label:            { ...typography.caption, color: theme.colors.textMuted },
  input:            { ...typography.body, color: theme.colors.textPrimary, paddingVertical: spacing.sm },
});
