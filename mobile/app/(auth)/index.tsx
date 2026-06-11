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
import { colors, shadows, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Button } from '@/components/ui/Button';
import { registerPushToken } from '@/lib/notifications';
import { t } from '@/lib/i18n';

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
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  if (token) return <Redirect href="/(tabs)" />;

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
      <FloatingDot x="10%" y={100} size={18} color={colors.yellow} delay={0} />
      <FloatingDot x="85%" y={140} size={14} color={colors.pink}   delay={300} />
      <FloatingDot x="15%" y={300} size={12} color={colors.mint}   delay={600} />
      <FloatingDot x="80%" y={360} size={16} color={colors.peach}  delay={900} />
      <FloatingDot x="50%" y={70}  size={10} color={colors.sky}    delay={1200} />
      <FloatingDot x="35%" y={520} size={14} color={colors.yellow} delay={1500} />

      <LinearGradient
        colors={['#FF9A9E', '#FECFEF', '#FFE8C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.headline}>{t('signin.headline')}</Text>
        <Text style={styles.subCopy}>{t('signin.sub_copy')}</Text>
      </LinearGradient>

      <View style={styles.bottom}>
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
        <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_URL)}>
          <Text style={styles.privacy}>{t('signin.privacy')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dot:       { position: 'absolute', borderRadius: 9999, opacity: 0.7, borderWidth: 2, borderColor: colors.ink, ...shadows.sticker },
  hero:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  headline:  { ...typography.heading, fontSize: 24, textAlign: 'center', marginBottom: spacing.sm },
  subCopy:   { ...typography.body, color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
  bottom:    { backgroundColor: colors.cream, paddingHorizontal: spacing['3xl'], paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] },
  buttons:   { gap: spacing.md },
  appleBtn:  { height: 52, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: colors.inkMuted, marginTop: spacing['3xl'], textAlign: 'center' },
});
