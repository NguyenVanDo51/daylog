import { Redirect, Tabs } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function TabLayout() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Redirect href="/(auth)" />;
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
