import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, typography } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useAlbumStore } from '@/stores/albumStore';
import { Button } from '@/components/ui/Button';

const TOKEN_KEY = 'auth_token';

export default function SignInScreen() {
  const { setAuth } = useAuthStore();
  const { setAlbum } = useAlbumStore();
  const [loading, setLoading] = useState<'apple' | 'google' | null>(null);

  async function handleApple() {
    try {
      setLoading('apple');
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const { data } = await api.post('/auth/apple', { identityToken: cred.identityToken, fullName: cred.fullName });
      await finishAuth(data.token, data.user);
    } catch (e: any) {
      if (e.code !== 'ERR_REQUEST_CANCELED') Alert.alert('Sign in failed', e.message);
    } finally {
      setLoading(null);
    }
  }

  async function finishAuth(token: string, user: any) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuth(token, user);
    try {
      const { data: albums } = await api.get('/albums', { headers: { Authorization: `Bearer ${token}` } });
      if (albums[0]) setAlbum(albums[0]);
    } catch {}
    router.replace('/(tabs)');
  }

  return (
    <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.container}>
      <View style={styles.bubbles}>
        {[...Array(6)].map((_, i) => (
          <View key={i} style={[styles.bubble, { width: 40 + i * 20, height: 40 + i * 20, left: (i * 60) % 300, top: (i * 90) % 400, opacity: 0.08 + i * 0.02 }]} />
        ))}
      </View>
      <View style={styles.content}>
        <Text style={styles.logo}>👶</Text>
        <Text style={styles.appName}>Family Guy</Text>
        <Text style={styles.tagline}>Capture every tiny moment</Text>

        <View style={styles.buttons}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={18}
            style={styles.appleBtn}
            onPress={handleApple}
          />
          <Button
            label="Sign in with Google"
            onPress={() => Alert.alert('Google sign-in', 'Coming soon')}
            variant="ghost"
            fullWidth
            loading={loading === 'google'}
          />
        </View>

        <Text style={styles.privacy}>By signing in, you agree to our Privacy Policy.</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubbles:   { ...StyleSheet.absoluteFillObject },
  bubble:    { position: 'absolute', borderRadius: 9999, backgroundColor: colors.white },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['3xl'] },
  logo:      { fontSize: 72, marginBottom: spacing.lg },
  appName:   { ...typography.heading, color: colors.white, fontSize: 32, marginBottom: spacing.xs },
  tagline:   { ...typography.body, color: 'rgba(255,255,255,0.8)', marginBottom: spacing['4xl'] },
  buttons:   { width: '100%', gap: spacing.md },
  appleBtn:  { height: 48, width: '100%', marginBottom: spacing.xs },
  privacy:   { ...typography.caption, color: 'rgba(255,255,255,0.6)', marginTop: spacing['3xl'], textAlign: 'center' },
});
