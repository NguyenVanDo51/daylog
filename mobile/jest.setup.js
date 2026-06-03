// Mock react-native-reanimated for tests
jest.mock('react-native-reanimated', () => ({
  Easing: {
    out: (fn) => fn,
    cubic: (t) => t,
  },
}));
