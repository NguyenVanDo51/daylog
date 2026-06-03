// Mock react-native-reanimated for tests
jest.mock('react-native-reanimated', () => ({
  Easing: {
    out: (fn) => fn,
    cubic: (t) => t,
  },
}));

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi', regionCode: 'VN' }],
}));
