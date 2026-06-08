import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold, Fredoka_700Bold } from '@expo-google-fonts/fredoka';
import { Caveat_500Medium, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { registerPushToken } from '@/lib/notifications';
import '@/lib/i18n'; // initialize default locale

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export default function RootLayout() {
  const { setAuth, clearAuth } = useAuthStore();
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Caveat_500Medium,
    Caveat_600SemiBold,
    Caveat_700Bold,
  });

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (stored) {
        const cachedUser = await SecureStore.getItemAsync(USER_KEY);
        if (cachedUser) setAuth(stored, JSON.parse(cachedUser));
        try {
          const { data } = await api.get('/users/me', { headers: { Authorization: `Bearer ${stored}` } });
          setAuth(stored, data);
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data));
          registerPushToken().catch(() => {});
        } catch (err: any) {
          if (err?.response?.status === 401) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
            clearAuth();
          }
        }
      }
      setReady(true);
    })();
  }, []);

  if (!ready || !fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="albums/[id]" />
            <Stack.Screen name="photo/[id]" options={{ presentation: 'fullScreenModal' }} />
<Stack.Screen name="photo-review" options={{ headerShown: false }} />
            <Stack.Screen name="story/[albumId]/[date]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            <Stack.Screen name="story/[albumId]/[date]/manage" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="join/[token]" />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
