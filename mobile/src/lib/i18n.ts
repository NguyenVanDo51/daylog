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

// Vietnamese-first: default to 'vi' until user explicitly picks another preference.
// Users can still choose "Theo thiết bị" in Settings to follow device locale.
applyLanguage('vi');

// Prevents race condition: if setLanguage() is called while AsyncStorage load is pending,
// we won't overwrite the explicit choice with the late-resolving stored preference.
let initialized = false;

// Then override from persisted preference as soon as AsyncStorage resolves.
AsyncStorage.getItem(LANGUAGE_KEY).then((stored) => {
  if (initialized) return;
  if (stored === 'vi' || stored === 'en' || stored === 'device') {
    applyLanguage(stored as AppLanguage);
  }
}).catch((err) => {
  if (__DEV__) console.warn('[i18n] AsyncStorage load failed:', err);
});

export async function setLanguage(pref: AppLanguage): Promise<void> {
  initialized = true;
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
