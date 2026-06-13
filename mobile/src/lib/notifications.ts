import * as Notifications from 'expo-notifications';
import * as Localization from 'expo-localization';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
  }),
});

function detectLanguage(): 'vi' | 'en' {
  const top = Localization.getLocales()[0]?.languageCode ?? 'vi';
  return top === 'en' ? 'en' : 'vi';
}

export async function registerPushToken() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = detectLanguage();
  await api.patch('/users/me', { push_token: token, timezone, language });
  return true;
}

export async function hasPushPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}
