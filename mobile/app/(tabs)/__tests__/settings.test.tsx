jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

const mockAlbumState = {
  clearAlbum: jest.fn(),
};

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: () => ({
    albumId: 'album-1',
    albumName: 'Test',
    childBirthdate: null,
    setAlbum: jest.fn(),
    clearAlbum: mockAlbumState.clearAlbum,
  }),
}));

const mockAuthState: {
  user: { id: string; display_name: string; email: string; avatar_url: string | null } | null;
  clearAuth: jest.Mock;
} = {
  user: { id: 'u1', display_name: 'Andy', email: 'andy@example.com', avatar_url: null },
  clearAuth: jest.fn(),
};

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: mockAuthState.user,
    token: 'jwt',
    clearAuth: mockAuthState.clearAuth,
  }),
}));

jest.mock('@/lib/notifications', () => ({
  registerPushToken: jest.fn(),
  hasPushPermission: jest.fn(),
}));

import React from 'react';
import { Alert, Switch } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import Screen from '../settings';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';

const mockRegisterPushToken = registerPushToken as jest.Mock;
const mockHasPushPermission = hasPushPermission as jest.Mock;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockRouter = router as unknown as { replace: jest.Mock; back: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPushPermission.mockResolvedValue(false);
  mockAlbumState.clearAlbum.mockReset();
  mockAuthState.clearAuth.mockReset();
  mockAuthState.user = { id: 'u1', display_name: 'Andy', email: 'andy@example.com', avatar_url: null };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SettingsTab', () => {
  it('renders heading and the user display name and email', async () => {
    const { getByText } = render(<Screen />);
    // Vietnamese heading: "Cài đặt"
    expect(getByText(/Cài đặt/)).toBeTruthy();
    expect(getByText('Andy')).toBeTruthy();
    expect(getByText('andy@example.com')).toBeTruthy();
    // Allow effect-resolved promise to settle.
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
  });

  it('does not render profile card when user is null', async () => {
    mockAuthState.user = null;
    const { queryByText } = render(<Screen />);
    expect(queryByText('andy@example.com')).toBeNull();
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
  });

  it('initialises the notification switch from hasPushPermission (granted)', async () => {
    mockHasPushPermission.mockResolvedValue(true);
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => {
      expect(UNSAFE_getByType(Switch).props.value).toBe(true);
    });
  });

  it('initialises the notification switch as false when permission not granted', async () => {
    mockHasPushPermission.mockResolvedValue(false);
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
    expect(UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('handles a rejection from hasPushPermission silently (catch branch)', async () => {
    mockHasPushPermission.mockRejectedValue(new Error('boom'));
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());
    expect(UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('turning the switch OFF sets local state to false without calling register', async () => {
    mockHasPushPermission.mockResolvedValue(true);
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(UNSAFE_getByType(Switch).props.value).toBe(true));

    await act(async () => {
      UNSAFE_getByType(Switch).props.onValueChange(false);
    });
    expect(UNSAFE_getByType(Switch).props.value).toBe(false);
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('turning the switch ON registers the push token and reflects success', async () => {
    mockRegisterPushToken.mockResolvedValue(true);
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());

    await act(async () => {
      UNSAFE_getByType(Switch).props.onValueChange(true);
    });

    expect(mockRegisterPushToken).toHaveBeenCalled();
    expect(UNSAFE_getByType(Switch).props.value).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('turning ON shows a permission-denied alert when registerPushToken returns false', async () => {
    mockRegisterPushToken.mockResolvedValue(false);
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());

    await act(async () => {
      UNSAFE_getByType(Switch).props.onValueChange(true);
    });

    // Vietnamese error alert
    expect(Alert.alert).toHaveBeenCalledWith(
      'Có lỗi xảy ra',
      'Vào Cài đặt thiết bị để bật thông báo.',
    );
    expect(UNSAFE_getByType(Switch).props.value).toBe(false);
  });

  it('turning ON shows an unavailable alert if registerPushToken throws', async () => {
    mockRegisterPushToken.mockRejectedValue(new Error('nope'));
    const { UNSAFE_getByType } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());

    await act(async () => {
      UNSAFE_getByType(Switch).props.onValueChange(true);
    });

    // Vietnamese error alert
    expect(Alert.alert).toHaveBeenCalledWith(
      'Có lỗi xảy ra',
      'Không thể đăng ký thông báo.',
    );
  });

  it('calls router.back when the back button is pressed', async () => {
    const { getByTestId } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());

    fireEvent.press(getByTestId('settings-back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('Sign Out deletes the secure-store token, clears auth + album, and navigates to /(auth)', async () => {
    const { getByText } = render(<Screen />);
    await waitFor(() => expect(mockHasPushPermission).toHaveBeenCalled());

    await act(async () => {
      // Vietnamese sign out button: "Đăng xuất"
      fireEvent.press(getByText('Đăng xuất'));
    });

    await waitFor(() => {
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token');
    });
    expect(mockAuthState.clearAuth).toHaveBeenCalledTimes(1);
    expect(mockAlbumState.clearAlbum).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)');
  });
});
