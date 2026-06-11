import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { vi } from '@/locales/vi';
import { en } from '@/locales/en';

export const LANGUAGE_KEY = 'app_language';
export type AppLanguage = 'device' | 'vi' | 'en';

export const i18n = new I18n({ vi, en });
i18n.defaultLocale = 'vi';
i18n.enableFallback = true;

function deviceLocale(): string {
  const code = getLocales()[0]?.languageCode ?? 'vi';
  return code === 'en' ? 'en' : 'vi';
}

function applyLanguage(pref: AppLanguage): void {
  i18n.locale = pref === 'device' ? deviceLocale() : pref;
}

// Synchronous default so the first render has a locale set.
applyLanguage('device');

// Then override from persisted preference as soon as AsyncStorage resolves.
AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
  if (stored === 'vi' || stored === 'en' || stored === 'device') {
    applyLanguage(stored);
  }
}).catch(() => {});

export async function setLanguage(pref: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, pref);
  applyLanguage(pref);
}

export async function getCurrentLanguage(): Promise<AppLanguage> {
  const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
  if (stored === 'vi' || stored === 'en' || stored === 'device') return stored;
  return 'device';
}

export const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.t(key, params);
