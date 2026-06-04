// Mocks must be declared before imports of the modules they replace.
jest.mock('@/lib/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('@/lib/notifications', () => ({
  registerPushToken: jest.fn().mockResolvedValue(true),
}));

const mockSetAuth = jest.fn();
const mockSetAlbum = jest.fn();

jest.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({ setAuth: mockSetAuth }),
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: () => ({ setAlbum: mockSetAlbum }),
}));

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { api } from '@/lib/api';
import { registerPushToken } from '@/lib/notifications';
import SignIn from '../index';

const mockApi = api as jest.Mocked<typeof api>;
const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockRouter = router as jest.Mocked<typeof router>;
const mockAppleSignInAsync = AppleAuthentication.signInAsync as jest.Mock;
const mockGoogleSignIn = GoogleSignin.signIn as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // clearAllMocks resets resolved values set in jest.setup.js for SecureStore.
  mockSecureStore.setItemAsync.mockResolvedValue(undefined);
  mockRegisterPushToken.mockResolvedValue(true);
  // Default: no albums returned.
  mockApi.get.mockResolvedValue({ data: [] } as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('SignInScreen', () => {
  it('renders Apple and Google sign-in buttons', () => {
    const { getByText, UNSAFE_getAllByType } = render(<SignIn />);
    // Google button rendered by our own <Button> component, identified by label.
    expect(getByText('Đăng nhập với Google')).toBeTruthy();
    // Apple button mocked as host component name 'AppleAuthenticationButton'.
    expect(
      UNSAFE_getAllByType('AppleAuthenticationButton' as never).length,
    ).toBeGreaterThan(0);
    // Headline rendered (en locale)
    expect(getByText('Mỗi ngày bé lớn thêm một chút')).toBeTruthy();
  });

  describe('handleApple', () => {
    it('signs in, persists token, registers push, fetches albums, and navigates to (tabs)', async () => {
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-id-token',
        fullName: { givenName: 'Ada', familyName: 'Lovelace' },
      });
      mockApi.post.mockResolvedValueOnce({
        data: { token: 'jwt-apple', user: { id: 'u-apple' } },
      } as never);
      mockApi.get.mockResolvedValueOnce({
        data: [{ id: 'a1', name: 'My Album', child_birthdate: null }],
      } as never);

      const { UNSAFE_getAllByType } = render(<SignIn />);
      const appleBtn = UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0];
      fireEvent.press(appleBtn);

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/apple', {
          identityToken: 'apple-id-token',
          fullName: { givenName: 'Ada', familyName: 'Lovelace' },
        });
      });

      await waitFor(() => {
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'auth_token',
          'jwt-apple',
        );
      });
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-apple', { id: 'u-apple' });
      expect(mockRegisterPushToken).toHaveBeenCalled();

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/albums', {
          headers: { Authorization: 'Bearer jwt-apple' },
        });
      });

      expect(mockSetAlbum).toHaveBeenCalledWith({
        id: 'a1',
        name: 'My Album',
        child_birthdate: null,
      });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      });
    });

    it('silently ignores Apple cancel (ERR_REQUEST_CANCELED)', async () => {
      const err: any = new Error('canceled');
      err.code = 'ERR_REQUEST_CANCELED';
      mockAppleSignInAsync.mockRejectedValueOnce(err);

      const { UNSAFE_getAllByType } = render(<SignIn />);
      const appleBtn = UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0];
      fireEvent.press(appleBtn);

      await waitFor(() => {
        expect(mockAppleSignInAsync).toHaveBeenCalled();
      });

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('alerts when Apple sign-in rejects with a non-cancel error', async () => {
      const err: any = new Error('apple-blew-up');
      err.code = 'ERR_SOMETHING_ELSE';
      mockAppleSignInAsync.mockRejectedValueOnce(err);

      const { UNSAFE_getAllByType } = render(<SignIn />);
      const appleBtn = UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0];
      fireEvent.press(appleBtn);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Đăng nhập thất bại', 'apple-blew-up');
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });
  });

  describe('handleGoogle', () => {
    it('signs in, persists token, registers push, fetches albums, and navigates to (tabs)', async () => {
      mockGoogleSignIn.mockResolvedValueOnce({
        type: 'success',
        data: { idToken: 'google-id-token' },
      });
      mockApi.post.mockResolvedValueOnce({
        data: { token: 'jwt-google', user: { id: 'u-google' } },
      } as never);
      mockApi.get.mockResolvedValueOnce({
        data: [{ id: 'a2', name: 'Album 2', child_birthdate: '2020-01-01' }],
      } as never);

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/auth/google', {
          idToken: 'google-id-token',
        });
      });
      await waitFor(() => {
        expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
          'auth_token',
          'jwt-google',
        );
      });
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-google', { id: 'u-google' });
      expect(mockRegisterPushToken).toHaveBeenCalled();
      expect(mockSetAlbum).toHaveBeenCalledWith({
        id: 'a2',
        name: 'Album 2',
        child_birthdate: '2020-01-01',
      });

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      });
    });

    it('silently ignores Google cancel (statusCodes.SIGN_IN_CANCELLED)', async () => {
      const err: any = new Error('user canceled');
      err.code = 'CANCELLED';
      mockGoogleSignIn.mockRejectedValueOnce(err);

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => {
        expect(mockGoogleSignIn).toHaveBeenCalled();
      });

      expect(Alert.alert).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockApi.post).not.toHaveBeenCalled();
    });

    it('alerts when Google returns success without an idToken', async () => {
      mockGoogleSignIn.mockResolvedValueOnce({
        type: 'success',
        data: { idToken: null },
      });

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Đăng nhập thất bại',
          'No idToken returned from Google',
        );
      });
      expect(mockApi.post).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('alerts when Google sign-in rejects with a generic error', async () => {
      mockGoogleSignIn.mockRejectedValueOnce(new Error('google-network-fail'));

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Đăng nhập thất bại',
          'google-network-fail',
        );
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('returns silently when Google response is not a success type', async () => {
      mockGoogleSignIn.mockResolvedValueOnce({ type: 'cancelled' });

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => expect(mockGoogleSignIn).toHaveBeenCalled());
      expect(Alert.alert).not.toHaveBeenCalled();
      expect(mockApi.post).not.toHaveBeenCalled();
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('falls back to "Unknown error" when rejected error has no message', async () => {
      mockGoogleSignIn.mockRejectedValueOnce({});

      const { getByText } = render(<SignIn />);
      fireEvent.press(getByText('Đăng nhập với Google'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Đăng nhập thất bại', 'Có lỗi xảy ra');
      });
    });
  });

  describe('finishAuth', () => {
    it('swallows registerPushToken rejection without blocking navigation', async () => {
      mockRegisterPushToken.mockRejectedValueOnce(new Error('push registration failed'));
      mockAppleSignInAsync.mockResolvedValueOnce({ identityToken: 'apple-tok', fullName: null });
      mockApi.post.mockResolvedValueOnce({ data: { token: 'jwt-push', user: { id: 'u-push' } } } as never);
      mockApi.get.mockResolvedValueOnce({ data: [] } as never);

      const { UNSAFE_getAllByType } = render(<SignIn />);
      fireEvent.press(UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0]);

      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
    });

    it('swallows api.get(/albums) rejection without blocking navigation', async () => {
      mockAppleSignInAsync.mockResolvedValueOnce({ identityToken: 'apple-tok', fullName: null });
      mockApi.post.mockResolvedValueOnce({ data: { token: 'jwt-fail-get', user: { id: 'u-fail-get' } } } as never);
      mockApi.get.mockReset();
      mockApi.get.mockRejectedValueOnce(new Error('albums fetch failed'));

      const { UNSAFE_getAllByType } = render(<SignIn />);
      fireEvent.press(UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0]);

      await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)'));
      expect(mockSetAlbum).not.toHaveBeenCalled();
    });

    it('handles an empty albums list without calling setAlbum and still navigates', async () => {
      mockAppleSignInAsync.mockResolvedValueOnce({
        identityToken: 'apple-tok',
        fullName: null,
      });
      mockApi.post.mockResolvedValueOnce({
        data: { token: 'jwt-empty', user: { id: 'u-empty' } },
      } as never);
      mockApi.get.mockResolvedValueOnce({ data: [] } as never);

      const { UNSAFE_getAllByType } = render(<SignIn />);
      const appleBtn = UNSAFE_getAllByType('AppleAuthenticationButton' as never)[0];
      fireEvent.press(appleBtn);

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      });

      expect(mockSetAlbum).not.toHaveBeenCalled();
      // setAuth still called for the empty-albums success path.
      expect(mockSetAuth).toHaveBeenCalledWith('jwt-empty', { id: 'u-empty' });
    });
  });
});
