import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, shadows } from '@/constants/theme';
import { UploadSheet } from '@/components/upload/UploadSheet';

function FABButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.fabWrap} activeOpacity={0.85}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.fab}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </LinearGradient>
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
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: { borderTopColor: colors.border, backgroundColor: colors.white },
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="milestones"
          options={{ title: 'Moments', tabBarIcon: ({ color, size }) => <Ionicons name="star" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="upload"
          options={{
            title: '',
            tabBarButton: () => <FABButton onPress={() => setUploadVisible(true)} />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{ title: 'Family', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }}
        />
      </Tabs>
      <UploadSheet visible={uploadVisible} onClose={() => setUploadVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: { top: -16, ...shadows.fab },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});
