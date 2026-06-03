import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { GoogleSignin, isSuccessResponse, statusCodes } from '@react-native-google-signin/google-signin';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Button } from '@/components/ui/Button';
import { registerPushToken } from '@/lib/notifications';
import { t } from '@/lib/i18n';

const TOKEN_KEY = 'auth_token';

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
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      const { data } = await api.post('/auth/apple', { identityToken: cred.identityToken, fullName: cred.fullName });
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
    setAuth(token, user);
    registerPushToken().catch(() => {});
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <FloatingDot x="10%" y={100} size={18} color={colors.yellow} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={colors.pink}   delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={colors.mint}   delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={colors.peach}  delay={900} />
      <FloatingDot x="50%" y={70}  size={10} color={colors.sky}    delay={1200} />
      <FloatingDot x="35%" y={520} size={14} color={colors.yellow} delay={1500} />

      <View style={styles.content}>
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.appName}>Family Guy</Text>
        <Text style={styles.tagline}>{t('signin.tagline')}</Text>

        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={22}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Button label={t('signin.google')} onPress={handleGoogle} variant="ghost" fullWidth loading={loading === 'google'} />
        </View>

        <Text style={styles.privacy}>{t('signin.privacy')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cream },
  dot:       { position: 'absolute', borderRadius: 9999, opacity: 0.7, borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  appName:   { ...typography.display, fontSize: 32, color: colors.ink, marginBottom: spacing.xs },
  tagline:   { ...typography.handAccent, color: colors.pink, fontSize: 20, marginBottom: spacing['4xl'] },
  buttons:   { width: '100%', gap: spacing.md },
  appleBtn:  { height: 52, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: colors.inkMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
