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
      dismissAll: jest.fn(),
      canGoBack: jest.fn(() => false),
    },
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      navigate: jest.fn(),
      dismissAll: jest.fn(),
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

// @expo/vector-icons — pulls in expo-font/expo-asset which are not installed for jest.
// Mock all icon sets used across the app with a lightweight View-based stub.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const makeIcon = (name) => (props) => React.createElement(View, { testID: name, ...props });
  return {
    Ionicons: makeIcon('Ionicons'),
    MaterialIcons: makeIcon('MaterialIcons'),
    FontAwesome: makeIcon('FontAwesome'),
    AntDesign: makeIcon('AntDesign'),
  };
});

// expo-localization — used by src/lib/i18n.ts.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'vi', languageTag: 'vi', regionCode: 'VN' }],
}));

// react-native-reanimated — transitive dep via expo-router/gesture-handler.
// Using a custom mock instead of require('react-native-reanimated/mock') because
// react-native-worklets (a dep of reanimated 4.x) fails native init in Jest.
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View, Text, Image, ScrollView } = require('react-native');
  const identity = (x) => x;
  const noopAnimFn = (val) => val;
  return {
    default: {
      Value: jest.fn(),
      createAnimatedComponent: (c) => c,
      timing: jest.fn(),
      spring: jest.fn(),
      add: jest.fn(),
      multiply: jest.fn(),
      View,
      Text,
      Image,
      ScrollView,
    },
    Easing: {
      out: identity,
      in: identity,
      inOut: identity,
      linear: identity,
      ease: 0,
      quad: identity,
      cubic: identity,
      exp: identity,
      elastic: () => identity,
      back: () => identity,
      bounce: identity,
      bezier: () => identity,
      circle: identity,
      sin: identity,
      poly: () => identity,
      step0: identity,
      step1: identity,
    },
    useSharedValue: jest.fn((v) => ({ value: v })),
    useAnimatedStyle: jest.fn((fn) => fn()),
    useAnimatedScrollHandler: jest.fn(() => ({})),
    useAnimatedRef: jest.fn(() => ({ current: null })),
    useDerivedValue: jest.fn((fn) => ({ value: fn() })),
    useAnimatedGestureHandler: jest.fn(() => ({})),
    withTiming: jest.fn((v) => v),
    withSpring: jest.fn((v) => v),
    withRepeat: jest.fn((v) => v),
    withSequence: jest.fn((...args) => args[0]),
    withDelay: jest.fn((_, v) => v),
    cancelAnimation: jest.fn(),
    runOnJS: jest.fn((fn) => fn),
    runOnUI: jest.fn((fn) => fn),
    interpolate: jest.fn((v) => v),
    interpolateColor: jest.fn(() => '#000000'),
    createAnimatedComponent: (c) => c,
    Animated: {
      Value: jest.fn(),
      View,
      Text,
      Image,
      ScrollView,
      createAnimatedComponent: (c) => c,
    },
    View,
    Text,
    Image,
    ScrollView,
    FlatList: require('react-native').FlatList,
  };
});

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
// We use a forwardRef stub so that ref.current?.present()/.dismiss() return resolved Promises.
jest.mock('@lodev09/react-native-true-sheet', () => {
  const React = require('react');
  const resolvedFn = jest.fn(() => Promise.resolve());
  return {
    TrueSheet: React.forwardRef(({ children, ...props }, ref) => {
      React.useImperativeHandle(ref, () => ({
        present: resolvedFn,
        dismiss: resolvedFn,
      }), []);
      return React.createElement('TrueSheet', props, children);
    }),
  };
});

// expo-video — used by photo detail screen for video playback.
jest.mock('expo-video', () => {
  const React = require('react');
  const { View } = require('react-native');
  const playerInstance = {
    loop: false,
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    replaceAsync: jest.fn(() => Promise.resolve()),
    seekBy: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    status: 'idle',
    duration: 0,
    currentTime: 0,
    muted: false,
  };
  return {
    VideoView: ({ style, ...props }) =>
      React.createElement(View, { testID: 'video-view', style }),
    useVideoPlayer: jest.fn((_uri, setup) => {
      if (setup) setup(playerInstance);
      return playerInstance;
    }),
  };
});

// expo-audio — used by story screen for day soundtrack playback.
jest.mock('expo-audio', () => ({
  useAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    replace: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    loop: false,
    volume: 1,
  })),
}));

// @react-native-async-storage/async-storage — used by captureStore persist middleware.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  getAllKeys: jest.fn().mockResolvedValue([]),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
  mergeItem: jest.fn().mockResolvedValue(undefined),
  multiMerge: jest.fn().mockResolvedValue(undefined),
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

// expo-video-thumbnails — used by useCapture for video thumbnail extraction.
jest.mock('expo-video-thumbnails', () => ({
  VideoThumbnails: {
    getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file://mock-thumb.jpg', width: 320, height: 240 }),
  },
  getThumbnailAsync: jest.fn().mockResolvedValue({ uri: 'file://mock-thumb.jpg', width: 320, height: 240 }),
}));

// react-native-svg — peer dep of phosphor-react-native; native rendering not available in Jest.
// __esModule:true prevents _interopRequireWildcard from wrapping the module, so .default stays a fn.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const stub = (props) => React.createElement(View, props);
  return {
    __esModule: true,
    default: stub,
    Svg: stub, Circle: stub, Ellipse: stub, G: stub, Text: stub, TSpan: stub,
    TextPath: stub, Path: stub, Polygon: stub, Polyline: stub, Line: stub,
    Rect: stub, Use: stub, Image: stub, Symbol: stub, Defs: stub,
    LinearGradient: stub, RadialGradient: stub, Stop: stub,
    ClipPath: stub, Pattern: stub, Mask: stub,
  };
});

// @sentry/react-native — uses ESM export syntax incompatible with Jest's CommonJS transform.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (component) => component,
  setUser: jest.fn(),
  reactNativeTracingIntegration: jest.fn(() => ({})),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// expo-media-library — used by StorageFreedomModal.
jest.mock('expo-media-library', () => ({
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  getAssetsAsync: jest.fn().mockResolvedValue({ assets: [], totalCount: 0 }),
  deleteAssetsAsync: jest.fn().mockResolvedValue({ status: 'success' }),
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
}));
