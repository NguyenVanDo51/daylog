import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '@/constants/theme';
import { UploadSheet } from '@/components/upload/UploadSheet';
import { tap } from '@/lib/haptics';
import { t } from '@/lib/i18n';

function FABButton({ onPress }: { onPress: () => void }) {
  function handle() { tap(); onPress(); }
  return (
    <TouchableOpacity onPress={handle} style={styles.fabWrap} activeOpacity={0.85}>
      <View style={styles.ring}>
        <LinearGradient colors={[colors.peach, colors.pink]} style={styles.fab} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="add" size={28} color={colors.white} />
        </LinearGradient>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const [uploadVisible, setUploadVisible] = useState(false);

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
        <Tabs.Screen name="index"     options={{ title: t('tabs.home'),    tabBarIcon: ({ color, size }) => <Ionicons name="home"            size={size} color={color} /> }} />
        <Tabs.Screen name="upload"    options={{ title: '',                tabBarButton: () => <FABButton onPress={() => setUploadVisible(true)} /> }} />
        <Tabs.Screen name="family"    options={{ title: t('tabs.family'),  tabBarIcon: ({ color, size }) => <Ionicons name="people"          size={size} color={color} /> }} />
        <Tabs.Screen name="settings"  options={{ title: t('tabs.me'),      tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
      </Tabs>
      <UploadSheet visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { top: -12 },
  ring:    { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadows.fab },
  fab:     { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
});
