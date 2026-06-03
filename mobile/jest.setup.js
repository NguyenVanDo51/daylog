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

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }) => React.createElement(View, null, children),
    SafeAreaView:     ({ children }) => React.createElement(View, null, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    initialWindowMetrics: { insets: { top: 0, right: 0, bottom: 0, left: 0 }, frame: { x: 0, y: 0, width: 0, height: 0 } },
  };
});

// @lodev09/react-native-true-sheet — native sheet component used by SheetModal and UploadSheet.
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: 'TrueSheet',
}));
