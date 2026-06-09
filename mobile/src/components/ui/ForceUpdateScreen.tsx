import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { colors, typography, spacing } from '@/constants/theme';

const STORE_URL =
  Platform.OS === 'ios'
    ? (process.env.EXPO_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com')
    : 'https://play.google.com/store/apps/details?id=com.daylog.app';

export function ForceUpdateScreen() {
  function handleUpdate() {
    Linking.openURL(STORE_URL);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={typography.display}>Cần cập nhật ứng dụng</Text>
      <Text style={[typography.body, styles.message]}>
        Phiên bản này đã cũ và không còn hoạt động được nữa.
      </Text>
      <View style={styles.button}>
        <Button label="Cập nhật ngay" onPress={handleUpdate} fullWidth />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    gap: spacing[4],
  },
  message: {
    textAlign: 'center',
    color: colors.inkSoft,
  },
  button: {
    width: '100%',
  },
});
