// Global native module mocks for jest tests.
// Each mock returns the minimum shape used by app/src code. Only modules
// actually imported by mobile/app or mobile/src are mocked here.

require('react-native-gesture-handler/jestSetup');

// expo-router — used by every screen and several components for navigation.
jest.mock('expo-router', () => {
  const React = require('react');
  const Pass = ({ children }) => children;
  const StackComponent = Object.assign(Pass, { Screen: Pass });
  const TabsComponent = Object.assign(Pass, { Screen: Pass });
  return {
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      canGoBack: jest.fn(() => false),
    },
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      canGoBack: jest.fn(() => false),
    }),
    useLocalSearchParams: jest.fn(() => ({})),
    useSegments: jest.fn(() => []),
    usePathname: jest.fn(() => '/'),
    useFocusEffect: jest.fn((cb) => {
      try {
        cb();
      } catch {}
    }),
    Stack: StackComponent,
    Tabs: TabsComponent,
    Link: ({ children }) => children,
    Redirect: () => null,
  };
});

// expo-secure-store — used by auth flow and settings screen.
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// expo-notifications — used by src/lib/notifications.ts.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true, granted: true }),
  requestPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', canAskAgain: true, granted: true }),
  getDevicePushTokenAsync: jest
    .fn()
    .mockResolvedValue({ type: 'apns', data: 'apns-token-fake' }),
  getExpoPushTokenAsync: jest
    .fn()
    .mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));

// expo-image — used by photo viewer.
jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// expo-image-picker — used by upload hook and exif util.
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ status: 'granted', granted: true }),
  MediaTypeOptions: { Images: 'Images', Videos: 'Videos', All: 'All' },
  ImagePickerStatus: {},
}));

// expo-camera — used by QR scanner sheet.
jest.mock('expo-camera', () => {
  const React = require('react');
  return {
    CameraView: React.forwardRef((_props, _ref) => null),
    Camera: React.forwardRef((_props, _ref) => null),
    useCameraPermissions: () => [{ granted: true }, jest.fn()],
  };
});

// expo-clipboard — used by InviteSheet.
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
  hasStringAsync: jest.fn().mockResolvedValue(false),
}));

// expo-linear-gradient — used by sign-in, tabs layout, header gradient.
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// expo-apple-authentication — used by sign-in screen.
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  AppleAuthenticationButton: 'AppleAuthenticationButton',
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 'name', EMAIL: 'email' },
}));

// expo-image-manipulator — used by src/lib/compression.ts.
// NOTE: the existing compression.test.ts does its own jest.mock at top of file,
// which will override this for that test. Default mock is provided here so other
// tests that touch compression utilities work without per-file mocks.
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn().mockResolvedValue({ uri: 'file://mock.webp' }),
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
}));

// @react-native-google-signin/google-signin — used by sign-in screen.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    isSignedIn: jest.fn().mockResolvedValue(false),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    getCurrentUser: jest.fn().mockResolvedValue(null),
  },
  isSuccessResponse: (r) => r?.type === 'success',
  isErrorWithCode: (e) => !!e?.code,
  statusCodes: {
    SIGN_IN_CANCELLED: 'CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
  },
  GoogleSigninButton: 'GoogleSigninButton',
}));

// expo-localization — used by src/lib/i18n.ts.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi', regionCode: 'VN' }],
}));

// react-native-reanimated — transitive dep via expo-router/gesture-handler.
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// react-native-safe-area-context — used by root layout, photo viewer, header gradient.
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: inset, frame: { x: 0, y: 0, width: 0, height: 0 } },
  };
});

// @lodev09/react-native-true-sheet — native sheet component used by SheetModal and UploadSheet.
jest.mock('@lodev09/react-native-true-sheet', () => ({
  TrueSheet: 'TrueSheet',
}));
