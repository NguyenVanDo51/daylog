import { i18n, t } from '../i18n';

describe('i18n', () => {
  it('defaults to vi locale', () => {
    expect(i18n.locale).toBe('vi');
  });

  it('renders Vietnamese strings by default', () => {
    expect(t('tabs.albums')).toBe('Album');
    expect(t('tabs.moments')).toBe('Khoảnh khắc');
    expect(t('tabs.family')).toBe('Gia đình');
    expect(t('tabs.me')).toBe('Tôi');
  });

  it('falls back to en when key missing in vi', () => {
    expect(i18n.enableFallback).toBe(true);
  });
});
