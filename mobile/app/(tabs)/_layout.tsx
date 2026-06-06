import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { UploadSheet } from '@/components/upload/UploadSheet';
import { useUploadSheetStore } from '@/stores/uploadSheetStore';
import { t } from '@/lib/i18n';

export default function TabLayout() {
  const uploadVisible = useUploadSheetStore((s) => s.isOpen);
  const closeUpload = useUploadSheetStore((s) => s.close);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.pink,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: { borderTopColor: colors.ink, borderTopWidth: 2, backgroundColor: colors.white, height: 64 },
          tabBarLabelStyle: { fontFamily: 'Fredoka_600SemiBold', fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t('tabs.albums'),
            tabBarIcon: ({ color, size }) => <Ionicons name="images-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t('tabs.me'),
            tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
      <UploadSheet visible={uploadVisible} onClose={closeUpload} />
    </>
  );
}
