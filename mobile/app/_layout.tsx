import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SecureStore from 'expo-secure-store';
import { useFonts, Baloo2_400Regular, Baloo2_500Medium, Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { api } from '@/lib/api';
import { API_URL } from '@/constants/api';
import { registerPushToken } from '@/lib/notifications';
import { useAppUpdate } from '@/lib/useAppUpdate';
import { ForceUpdateScreen } from '@/components/ui/ForceUpdateScreen';
import '@/lib/i18n'; // initialize default locale

Sentry.init({
  dsn: Constants.expoConfig?.extra?.sentryDsn,
  tracesSampleRate: 0.2,
  tracePropagationTargets: [API_URL],
  integrations: [Sentry.reactNativeTracingIntegration(), Sentry.mobileReplayIntegration()],
  environment: __DEV__ ? 'development' : 'production',
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const ONBOARDING_KEY = 'onboarding.seen';

function RootLayout() {
  const { setAuth, clearAuth } = useAuthStore();
  const setSeen = useOnboardingStore((s) => s.setSeen);
  const [ready, setReady] = useState(false);
  const updateStatus = useAppUpdate();
  const [fontsLoaded] = useFonts({
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
  });

  useEffect(() => {
    (async () => {
      const e2eToken = process.env.EXPO_PUBLIC_E2E_TEST_TOKEN;
      if (e2eToken) {
        setAuth(e2eToken, { id: 'e2e-user', display_name: 'E2E Test', email: 'e2e@test.local', avatar_url: null });
        setSeen(true); // E2E tests skip onboarding.
        setReady(true);
        return;
      }

      // Onboarding: read the flag in parallel with token load. Mark seen if a
      // token is found (existing user) so they don't see onboarding after a
      // future sign-out.
      const [obFlag, stored] = await Promise.all([
        SecureStore.getItemAsync(ONBOARDING_KEY),
        SecureStore.getItemAsync(TOKEN_KEY),
      ]);
      let obSeen = obFlag === '1';

      if (stored) {
        const cachedUser = await SecureStore.getItemAsync(USER_KEY);
        try {
          if (cachedUser) setAuth(stored, JSON.parse(cachedUser));
          const { data } = await api.get('/users/me', { headers: { Authorization: `Bearer ${stored}` } });
          setAuth(stored, data);
          Sentry.setUser({ id: data.id });
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(data));
          registerPushToken().catch(() => { });
        } catch (err) {
          if ((err as { response?: { status?: number } }).response?.status === 401) {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
            clearAuth();
            Sentry.setUser(null);
          }
        }

        // Existing user — backfill the onboarding-seen flag if missing so a
        // future sign-out doesn't replay onboarding.
        if (!obSeen) {
          await SecureStore.setItemAsync(ONBOARDING_KEY, '1');
          obSeen = true;
        }
      }

      setSeen(obSeen);
      setReady(true);
    })();
  }, []);

  if (!fontsLoaded || updateStatus === 'checking') return null;
  if (updateStatus === 'force-update') {
    return (
      <SafeAreaProvider>
        <ForceUpdateScreen />
      </SafeAreaProvider>
    );
  }
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
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

export default Sentry.wrap(RootLayout);
