// Mock expo-asset and expo-font before any imports that transitively require them.
// expo-asset is not a direct dependency; use virtual:true so Jest doesn't try to resolve
// the actual package from node_modules.
jest.mock('expo-asset', () => ({
  Asset: { loadAsync: jest.fn().mockResolvedValue([]) },
}), { virtual: true });

jest.mock('expo-font', () => ({
  useFonts: jest.fn(() => [true, null]),
  isLoaded: jest.fn(() => true),
  loadAsync: jest.fn().mockResolvedValue(undefined),
  FontLoader: jest.fn(),
}));

jest.mock('@expo-google-fonts/fredoka', () => ({
  useFonts: jest.fn(() => [true, null]),
  Fredoka_400Regular: 'Fredoka_400Regular',
  Fredoka_500Medium: 'Fredoka_500Medium',
  Fredoka_600SemiBold: 'Fredoka_600SemiBold',
  Fredoka_700Bold: 'Fredoka_700Bold',
}));


import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

// Replace @expo/vector-icons with light host components in case any provider in
// the tree pulls them in transitively (root layout itself does not, but stays
// defensive for safety).
jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, { ...props, ref, testID: props.testID ?? label }),
    );
  return {
    Ionicons: makeIcon('Ionicons'),
    MaterialIcons: makeIcon('MaterialIcons'),
    MaterialCommunityIcons: makeIcon('MaterialCommunityIcons'),
    FontAwesome: makeIcon('FontAwesome'),
    Feather: makeIcon('Feather'),
    AntDesign: makeIcon('AntDesign'),
    Entypo: makeIcon('Entypo'),
  };
});

// Mock the @tanstack/react-query provider so we do not need a real client tree
// during these layout tests. Render children inside a host View so the rendered
// tree is non-null and we can assert providers wrap the layout.
jest.mock('@tanstack/react-query', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  return {
    QueryClient: jest.fn().mockImplementation(() => ({})),
    QueryClientProvider: ({ children }: { children: React.ReactNode }) =>
      ReactLib.createElement(
        ViewComp,
        { testID: 'query-client-provider' },
        children,
      ),
  };
});

// Override expo-router's Stack/Stack.Screen so they render to host components
// we can assert on. The global mock in jest.setup.js renders pass-through
// children, which loses the Stack.Screen names/options we care about.
jest.mock('expo-router', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;

  const recordedStackScreens: Array<{ name: string; options?: any }> = [];

  const StackComponent = ({ children, screenOptions }: any) =>
    ReactLib.createElement(
      ViewComp,
      { testID: 'stack-container', screenOptions },
      children,
    );
  const StackScreen = ({ name, options }: any) => {
    recordedStackScreens.push({ name, options });
    return ReactLib.createElement(ViewComp, {
      testID: `stack-screen-${name}`,
      // Surface the modal presentation as a string prop so we can read it back.
      presentation: options?.presentation ?? null,
    });
  };

  const Stack = Object.assign(StackComponent, { Screen: StackScreen });
  const routerSpy = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    canGoBack: jest.fn(() => false),
  };

  return {
    __recordedStackScreens: recordedStackScreens,
    router: routerSpy,
    useRouter: () => routerSpy,
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    usePathname: () => '/',
    useFocusEffect: (cb: () => void) => {
      try {
        cb();
      } catch {
        /* swallow */
      }
    },
    Stack,
    Tabs: Object.assign((p: any) => p.children, { Screen: (p: any) => p.children }),
    Link: ({ children }: any) => children,
    Redirect: () => null,
  };
});

// Mock useAppUpdate so it never calls the API — layout tests focus on auth bootstrap only.
jest.mock('@/lib/useAppUpdate', () => ({
  useAppUpdate: () => 'ok',
  checkOta: jest.fn(),
}));

// Mock the API client so the layout's GET /users/me call is fully controlled.
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

// Mock notifications so registerPushToken is a no-op spy.
jest.mock('@/lib/notifications', () => ({
  registerPushToken: jest.fn().mockResolvedValue(true),
}));

// Pull in the mocked modules so we can drive their behavior per test.
import { api } from '@/lib/api';
import { registerPushToken } from '@/lib/notifications';
import { useAuthStore } from '@/stores/authStore';
import RootLayout from '../_layout';
// Recorded screens are exposed by the local expo-router mock above.
const { __recordedStackScreens } = jest.requireMock('expo-router');

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;
const mockedRegisterPushToken = registerPushToken as jest.MockedFunction<
  typeof registerPushToken
>;
const mockedGetItemAsync = SecureStore.getItemAsync as jest.MockedFunction<
  typeof SecureStore.getItemAsync
>;
const mockedDeleteItemAsync = SecureStore.deleteItemAsync as jest.MockedFunction<
  typeof SecureStore.deleteItemAsync
>;
beforeEach(() => {
  jest.clearAllMocks();
  __recordedStackScreens.length = 0;
  useAuthStore.setState({ token: null, user: null });
});

describe('RootLayout', () => {
  it('renders the provider tree and registers eight Stack.Screen entries after the auth bootstrap settles', async () => {
    mockedGetItemAsync.mockResolvedValueOnce(null);

    const utils = render(<RootLayout />);

    // First render returns null because ready=false. After the effect resolves,
    // ready flips to true and the provider/Stack tree is committed.
    await waitFor(() => {
      expect(utils.queryByTestId('stack-container')).toBeTruthy();
    });

    // QueryClientProvider should have wrapped the Stack tree.
    expect(utils.getByTestId('query-client-provider')).toBeTruthy();

    // Eight routes are declared by the layout: (auth), (tabs), albums/[id],
    // photo/[id], photo-review, story/[albumId]/[date], story/[albumId]/[date]/manage, join/[token].
    const names = __recordedStackScreens.map((s: any) => s.name);
    expect(names).toEqual([
      '(auth)',
      '(tabs)',
      'albums/[id]',
      'photo/[id]',
      'photo-review',
      'story/[albumId]/[date]',
      'story/[albumId]/[date]/manage',
      'join/[token]',
    ]);

    // Modal presentations are wired correctly.
    const byName = Object.fromEntries(
      __recordedStackScreens.map((s: any) => [s.name, s]),
    );
    expect(byName['photo/[id]'].options?.presentation).toBe('fullScreenModal');
    expect(byName['story/[albumId]/[date]'].options?.presentation).toBe('fullScreenModal');

    // Stack-wide options disable the header globally.
    const stackContainer = utils.getByTestId('stack-container');
    expect((stackContainer.props as any).screenOptions).toEqual({
      headerShown: false,
    });
  });

  it('when SecureStore has a token and /users/me succeeds: sets auth state and registers push token', async () => {
    const fakeUser = {
      id: 'u1',
      display_name: 'Sarah',
      email: 'sarah@example.com',
      avatar_url: null,
    };
    mockedGetItemAsync.mockResolvedValueOnce('stored-jwt');
    mockedGet.mockResolvedValueOnce({ data: fakeUser } as any);

    render(<RootLayout />);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('stored-jwt');
    });

    expect(mockedGet).toHaveBeenCalledWith('/users/me', {
      headers: { Authorization: 'Bearer stored-jwt' },
    });
    expect(mockedGet).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toEqual(fakeUser);
    expect(mockedRegisterPushToken).toHaveBeenCalledTimes(1);
  });

  it('when SecureStore has a token but /users/me fails: clears token and clears auth state', async () => {
    mockedGetItemAsync.mockResolvedValueOnce('bad-jwt');
    mockedGet.mockRejectedValueOnce(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }));

    // Pre-populate the store so we can assert clearAuth() was called.
    useAuthStore.setState({
      token: 'bad-jwt',
      user: {
        id: 'u1',
        display_name: 'Sarah',
        email: 'sarah@example.com',
        avatar_url: null,
      },
    });

    render(<RootLayout />);

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBeNull();
    });

    expect(mockedDeleteItemAsync).toHaveBeenCalledWith('auth_token');
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockedRegisterPushToken).not.toHaveBeenCalled();
  });

  it('when SecureStore has no token: does not touch the API and keeps auth state clear', async () => {
    mockedGetItemAsync.mockResolvedValueOnce(null);

    const utils = render(<RootLayout />);

    // Wait for the bootstrap effect to complete (ready=true → stack renders).
    await waitFor(() => {
      expect(utils.queryByTestId('stack-container')).toBeTruthy();
    });

    expect(mockedGet).not.toHaveBeenCalled();
    expect(mockedRegisterPushToken).not.toHaveBeenCalled();
    expect(mockedDeleteItemAsync).not.toHaveBeenCalled();
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('swallows registerPushToken rejections without crashing the layout', async () => {
    const fakeUser = {
      id: 'u1',
      display_name: 'Sarah',
      email: 'sarah@example.com',
      avatar_url: null,
    };
    mockedGetItemAsync.mockResolvedValueOnce('stored-jwt');
    mockedGet.mockResolvedValueOnce({ data: fakeUser } as any);
    mockedRegisterPushToken.mockRejectedValueOnce(new Error('boom'));

    render(<RootLayout />);

    await waitFor(() => {
      // Auth state should still be applied even if push token registration fails.
      expect(useAuthStore.getState().token).toBe('stored-jwt');
    });

    // Even though registerPushToken rejected, the chained .catch should have
    // suppressed it and auth state should still be applied.
    expect(useAuthStore.getState().user).toEqual(fakeUser);

    // Let the swallowed rejection settle so it does not leak into other tests.
    await act(async () => {
      await Promise.resolve();
    });
  });
});
