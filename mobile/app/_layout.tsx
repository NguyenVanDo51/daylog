import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { registerPushToken } from '@/lib/notifications';

const TOKEN_KEY = 'auth_token';

export default function RootLayout() {
  const { token, setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        try {
          const { data } = await api.get('/users/me', {
            headers: { Authorization: `Bearer ${stored}` },
          });
          setAuth(stored, data);
          registerPushToken().catch(() => {});
        } catch {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          clearAuth();
        }
      }
      setReady(true);
    })();
  }, []);

  // Navigate only after the Stack is mounted (ready=true triggers re-render first)
  useEffect(() => {
    if (!ready) return;
    router.replace(token ? '/(tabs)' : '/(auth)');
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="milestone/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="milestone/[id]" />
          <Stack.Screen name="photo/[id]" options={{ presentation: 'fullScreenModal' }} />
          <Stack.Screen name="join/[token]" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
