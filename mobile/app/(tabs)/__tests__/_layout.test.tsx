jest.mock('@/lib/haptics', () => ({ tap: jest.fn(), success: jest.fn() }));

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// Replace @expo/vector-icons with host-component proxies so Ionicons renders to
// a real RN view with a testID we can target. The tabs layout uses Ionicons
// inside the FAB button and inside each Tabs.Screen's tabBarIcon callback.
jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const ViewComp = require('react-native').View;
  const makeIcon = (label: string) =>
    ReactLib.forwardRef((props: any, ref: any) =>
      ReactLib.createElement(ViewComp, {
        ...props,
        ref,
        // Use the `name` prop in the testID so we can assert which icon was used
        // per tab.
        testID: props.testID ?? `${label}-${props.name ?? 'unknown'}`,
      }),
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

// Override expo-router's Tabs mock so Tabs.Screen records the props it was
// rendered with (the global jest.setup.js mock renders pass-through children,
// which discards the rich `options` object we care about for assertions).
const recordedScreens: Array<{
  name: string;
  options?: any;
}> = [];
let recordedTabsProps: any = null;

jest.mock('expo-router', () => {
  const ReactLib = require('react');
  const View = require('react-native').View;

  const TabsComponent = ({ children, ...rest }: any) => {
    recordedTabsProps = rest;
    return ReactLib.createElement(
      View,
      { testID: 'tabs-container' },
      children,
    );
  };
  const TabsScreen = ({ name, options, ...rest }: any) => {
    recordedScreens.push({ name, options });
    // Render any icon / button so the icon callback paths are exercised.
    const children: any[] = [];
    if (options?.tabBarIcon) {
      children.push(
        ReactLib.createElement(View, {
          key: `${name}-icon`,
          testID: `tab-icon-${name}`,
          children: options.tabBarIcon({ color: '#000', size: 24, focused: false }),
        }),
      );
    }
    if (options?.tabBarButton) {
      children.push(
        ReactLib.createElement(View, {
          key: `${name}-button`,
          testID: `tab-button-${name}`,
          children: options.tabBarButton({}),
        }),
      );
    }
    return ReactLib.createElement(
      View,
      { testID: `tab-screen-${name}`, ...rest },
      children,
    );
  };

  const Tabs = Object.assign(TabsComponent, { Screen: TabsScreen });

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
    Stack: Object.assign((p: any) => p.children, { Screen: (p: any) => p.children }),
    Tabs,
    Link: ({ children }: any) => children,
    Redirect: () => null,
  };
});

import TabLayout from '../_layout';

beforeEach(() => {
  recordedScreens.length = 0;
  recordedTabsProps = null;
});

describe('TabLayout', () => {
  it('renders the Tabs container with minimal options', () => {
    const utils = render(<TabLayout />);
    expect(utils.getByTestId('tabs-container')).toBeTruthy();
    // screenOptions passed to <Tabs>
    expect(recordedTabsProps).toBeTruthy();
    expect(recordedTabsProps.screenOptions.headerShown).toBe(false);
    expect(recordedTabsProps.screenOptions.tabBarStyle).toEqual({
      display: 'none',
    });
  });

  it('declares the expected 2 Tabs.Screen entries in order', () => {
    render(<TabLayout />);
    const names = recordedScreens.map((s) => s.name);
    expect(names).toEqual(['index', 'settings']);
  });

  it('hides settings tab from navigation', () => {
    render(<TabLayout />);
    const byName = Object.fromEntries(recordedScreens.map((s) => [s.name, s]));

    // Settings should have href: null to hide it from tab navigation
    expect(byName.settings.options?.href).toBe(null);
  });

});
