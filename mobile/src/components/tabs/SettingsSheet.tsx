import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { SheetModal } from '@/components/ui/SheetModal';
import { useAuthStore } from '@/stores/authStore';
import { colors, spacing, typography } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SettingsSheet({ visible, onClose }: Props) {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  function handleSettings() {
    onClose();
    router.push('/(tabs)/settings');
  }

  function handleLogout() {
    onClose();
    clearAuth();
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <TouchableOpacity style={styles.item} onPress={handleSettings} testID="menu-settings">
          <Text style={styles.itemText}>Cài đặt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.item} onPress={handleLogout} testID="menu-logout">
          <Text style={[styles.itemText, styles.danger]}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body:     { paddingVertical: spacing.md },
  item:     { paddingVertical: spacing.md, paddingHorizontal: spacing['2xl'] },
  itemText: { ...typography.body, color: colors.ink },
  danger:   { color: '#c00' },
});
