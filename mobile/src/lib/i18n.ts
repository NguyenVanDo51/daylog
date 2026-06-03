import { I18n } from 'i18n-js';
import { getLocales } from 'expo-localization';
import { vi } from '@/locales/vi';
import { en } from '@/locales/en';

export const i18n = new I18n({ vi, en });
i18n.defaultLocale = 'vi';
i18n.enableFallback = true;

const deviceLocale = getLocales()[0]?.languageCode ?? 'vi';
// Force vi-first per project policy; only flip to en if device explicitly says so.
i18n.locale = deviceLocale === 'en' ? 'en' : 'vi';

export const t = (key: string, params?: Record<string, unknown>): string =>
  i18n.t(key, params);
