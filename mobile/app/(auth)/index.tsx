import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, type DimensionValue } from 'react-native';
import * as Linking from 'expo-linking';
import { PRIVACY_URL } from '@/constants/urls';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { theme, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { Mascot } from '@/components/ui/Mascot';
import { StickerChip } from '@/components/ui/StickerChip';
import { StickerButton } from '@/components/ui/StickerButton';
import { registerPushToken } from '@/lib/notifications';
import { t } from '@/lib/i18n';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

function AppleIcon({ size = 18, color = '#FFF6E0' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={color} d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </Svg>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <Path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
      <Path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <Path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </Svg>
  );
}

function FloatingDot({ x, y, size, color, delay }: { x: DimensionValue; y: number; size: number; color: string; delay: number }) {
  const yShared = useSharedValue(0);
  useEffect(() => {
    yShared.value = withRepeat(withSequence(withTiming(-10, { duration: 2200 + delay }), withTiming(0, { duration: 2200 + delay })), -1);
  }, [yShared, delay]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: yShared.value }] }));
  return <Animated.View style={[styles.dot, { left: x, top: y, width: size, height: size, backgroundColor: color }, anim]} />;
}

export default function SignInScreen() {
  const { token, setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const seen = useOnboardingStore((s) => s.seen);
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  if (token) return <Redirect href="/(tabs)" />;
  if (seen === false) return <Redirect href="/onboarding" />;

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!cred.identityToken) throw new Error('Apple không trả về identity token');
      const { data } = await api.post('/auth/apple', { idToken: cred.identityToken, fullName: cred.fullName });
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert(t('signin.failed'), e.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleGoogle() {
    try {
      setLoading('google');
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return;
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('No idToken returned from Google');
      const { data } = await api.post('/auth/google', { idToken });
      if (data.status === 'account_pending_deletion') {
        handlePendingDeletion(data);
        return;
      }
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) return;
      Alert.alert(t('signin.failed'), e.message ?? t('common.error'));
    } finally {
      setLoading(null);
    }
  }

  async function finishAuth(token: string, user: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    setAuth(token, user);
    registerPushToken().catch(() => {});
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  function handlePendingDeletion(data: { restore_token: string; days_remaining: number }) {
    router.replace({
      pathname: '/(auth)/restore',
      params: { restore_token: data.restore_token, days_remaining: String(data.days_remaining) },
    });
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.colors.backgroundHighlight, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <FloatingDot x="10%" y={100} size={18} color={theme.colors.accent1} delay={0} />
        <FloatingDot x="85%" y={140} size={14} color={theme.colors.primary}  delay={300} />
        <FloatingDot x="15%" y={300} size={12} color={theme.colors.accent2}  delay={600} />
        <FloatingDot x="80%" y={450} size={16} color={theme.colors.accent4}  delay={900} />

        <Mascot size={160} tilt="playful" flip />
        <View style={styles.logoWrap}>
          <StickerChip label="Daylog" variant="yellow" tilt="default" flip />
        </View>
        <Text style={styles.tagline}>{t('signin.tagline')}</Text>
        <Text style={styles.subCopy}>{t('signin.sub_copy')}</Text>
      </LinearGradient>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          <StickerButton
            label={t('signin.apple')}
            variant="inverted"
            fullWidth
            loading={loading === 'apple'}
            onPress={handleApple}
            icon={<AppleIcon size={20} />}
          />
          <StickerButton
            label={t('signin.google')}
            variant="surface"
            fullWidth
            loading={loading === 'google'}
            onPress={handleGoogle}
            icon={<GoogleIcon size={20} />}
          />
        </View>
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.privacy}>{t('signin.privacy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dot:       { position: 'absolute', borderRadius: theme.radii.pill, opacity: 0.7, borderWidth: theme.border.medium, borderColor: theme.colors.border, ...theme.shadows.sticker },
  hero:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'], gap: spacing.md },
  logoWrap:  { marginTop: spacing.lg },
  tagline:   { ...typography.title, color: theme.colors.textPrimary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: spacing.md },
  subCopy:   { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },
  bottom:    { backgroundColor: theme.colors.background, paddingHorizontal: spacing['3xl'], paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] },
  buttons:   { gap: spacing.md },
  privacy:   { ...typography.caption, color: theme.colors.textMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
