import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import * as Linking from 'expo-linking';
import { PRIVACY_URL } from '@/constants/urls';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
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
// Apple's HIG requires using their native button for Sign In with Apple.
// We keep AppleAuthenticationButton instead of substituting StickerButton.

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['profile', 'email'],
});

function FloatingDot({ x, y, size, color, delay }: { x: string; y: number; size: number; color: string; delay: number }) {
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
      <FloatingDot x="10%" y={100} size={18} color={theme.colors.accent1} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={theme.colors.primary}  delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={theme.colors.accent2}  delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={theme.colors.accent4}  delay={900} />

      <LinearGradient
        colors={[theme.colors.backgroundHighlight, theme.colors.background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Mascot size={80} tilt="playful" flip />
        <View style={styles.logoWrap}>
          <StickerChip label="Nhật ký" variant="yellow" tilt="default" flip />
        </View>
        <Text style={styles.tagline}>{t('signin.tagline')}</Text>
        <Text style={styles.subCopy}>{t('signin.sub_copy')}</Text>
      </LinearGradient>

      <View style={styles.bottom}>
        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={theme.radii.md}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <StickerButton
            label={t('signin.google')}
            variant="surface"
            fullWidth
            loading={loading === 'google'}
            onPress={handleGoogle}
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
  tagline:   { ...typography.body, color: theme.colors.textPrimary, fontFamily: theme.fonts.semiBold, textAlign: 'center', marginTop: spacing.md },
  subCopy:   { ...typography.body, color: theme.colors.textSecondary, textAlign: 'center', fontSize: 13 },
  bottom:    { backgroundColor: theme.colors.background, paddingHorizontal: spacing['3xl'], paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] },
  buttons:   { gap: spacing.md },
  appleBtn:  { height: 52, width: '100%' },
  privacy:   { ...typography.caption, color: theme.colors.textMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
