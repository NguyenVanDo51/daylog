// Mocks must be declared before imports of the modules they replace.
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockUseAuthStore = jest.fn();
jest.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { token: string | null }) => unknown) =>
    mockUseAuthStore(selector),
}));

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '@/lib/api';
import JoinScreen from '../[token]';

const mockApi = api as jest.Mocked<typeof api>;
const mockRouter = router as jest.Mocked<typeof router>;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  // Default: signed-in user.
  mockUseAuthStore.mockImplementation(
    (selector: (s: { token: string | null }) => unknown) =>
      selector({ token: 'jwt-token' }),
  );
  mockUseLocalSearchParams.mockReturnValue({ token: 'abc' });
  // Sensible defaults so the effect's `.then()` never crashes when tests
  // don't care about the GET. Individual tests override these as needed.
  mockApi.get.mockResolvedValue({ data: { album_name: 'Default Album' } } as never);
  mockApi.post.mockResolvedValue({ data: {} } as never);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('JoinScreen', () => {
  describe('unauthenticated', () => {
    it('shows invited message and sign-in button, navigates to (auth) when pressed', async () => {
      mockUseAuthStore.mockImplementation(
        (selector: (s: { token: string | null }) => unknown) =>
          selector({ token: null }),
      );

      const { getByText } = render(<JoinScreen />);

      // Vietnamese: t('join.invited_msg') = 'Bạn được mời tham gia ~'
      expect(getByText('Bạn được mời tham gia ~')).toBeTruthy();
      // t('signin.apple') = 'Đăng nhập với Apple'
      expect(getByText('Đăng nhập với Apple')).toBeTruthy();

      fireEvent.press(getByText('Đăng nhập với Apple'));
      expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)');

      // The mount effect still runs api.get; flush its resolution so the
      // subsequent setInvite state update is wrapped in act().
      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/invites/abc');
      });
    });

    it('does not fetch the invite when there is no token in params (effect early-returns)', async () => {
      mockUseAuthStore.mockImplementation(
        (selector: (s: { token: string | null }) => unknown) =>
          selector({ token: null }),
      );
      mockUseLocalSearchParams.mockReturnValue({});

      render(<JoinScreen />);

      // Wait a tick to allow any pending promises.
      await waitFor(() => {
        expect(mockApi.get).not.toHaveBeenCalled();
      });
    });
  });

  describe('authenticated', () => {
    it('renders null while the invite GET is pending', async () => {
      let resolveGet: ((v: { data: { album_name: string } }) => void) | undefined;
      mockApi.get.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGet = resolve;
          }),
      );

      const { toJSON, queryByText } = render(<JoinScreen />);

      // Component returns null while invite is not yet set.
      expect(toJSON()).toBeNull();
      expect(queryByText('Bạn được mời tham gia ~')).toBeNull();

      await act(async () => {
        resolveGet!({ data: { album_name: 'Emma Album' } });
      });

      await waitFor(() => {
        expect(queryByText('Bạn được mời tham gia ~')).toBeTruthy();
      });
    });

    it('fetches /invites/:token on mount and renders the album name', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });

      const { getByText } = render(<JoinScreen />);

      await waitFor(() => {
        expect(mockApi.get).toHaveBeenCalledWith('/invites/abc');
      });
      await waitFor(() => {
        expect(getByText('Emma Album')).toBeTruthy();
      });
      // Vietnamese: t('join.invited_msg') = 'Bạn được mời tham gia ~'
      expect(getByText('Bạn được mời tham gia ~')).toBeTruthy();
      // Vietnamese: t('join.cta') = 'Tham gia album'
      expect(getByText('Tham gia album')).toBeTruthy();
      // Vietnamese: t('common.cancel') = 'Huỷ'
      expect(getByText('Huỷ')).toBeTruthy();
    });

    it('alerts with Vietnamese error when the invite fetch fails (404/410)', async () => {
      const err: any = new Error('not found');
      err.response = { status: 404 };
      mockApi.get.mockRejectedValueOnce(err);

      render(<JoinScreen />);

      await waitFor(() => {
        // t('common.error') = 'Có lỗi xảy ra', Vietnamese body message
        expect(Alert.alert).toHaveBeenCalledWith(
          'Có lỗi xảy ra',
          'Link mời không hợp lệ hoặc đã hết hạn.',
        );
      });
    });

    it('posts to /invites/:token/join and replaces to /(tabs) on success', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });
      mockApi.post.mockResolvedValueOnce({ data: {} });

      const { getByText } = render(<JoinScreen />);

      await waitFor(() => {
        expect(getByText('Tham gia album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Tham gia album'));
      });

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/invites/abc/join');
      });
      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)');
      });
    });

    it('alerts with the server error message when the join post rejects', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });
      const err: any = new Error('network down');
      err.response = { data: { error: 'Already a member' } };
      mockApi.post.mockRejectedValueOnce(err);

      const { getByText } = render(<JoinScreen />);
      await waitFor(() => {
        expect(getByText('Tham gia album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Tham gia album'));
      });

      await waitFor(() => {
        // t('common.error') = 'Có lỗi xảy ra'
        expect(Alert.alert).toHaveBeenCalledWith('Có lỗi xảy ra', 'Already a member');
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('falls back to error.message when no server payload is returned', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });
      mockApi.post.mockRejectedValueOnce(new Error('boom'));

      const { getByText } = render(<JoinScreen />);
      await waitFor(() => {
        expect(getByText('Tham gia album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Tham gia album'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Có lỗi xảy ra', 'boom');
      });
    });

    it('navigates back when the Cancel button is pressed', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });

      const { getByText } = render(<JoinScreen />);
      await waitFor(() => {
        expect(getByText('Huỷ')).toBeTruthy();
      });

      fireEvent.press(getByText('Huỷ'));
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });
});
