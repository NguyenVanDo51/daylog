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
    it('shows sign-in prompt and navigates to (auth) when Sign In pressed', async () => {
      mockUseAuthStore.mockImplementation(
        (selector: (s: { token: string | null }) => unknown) =>
          selector({ token: null }),
      );

      const { getByText } = render(<JoinScreen />);

      expect(getByText(/Join Album/)).toBeTruthy();
      expect(getByText('You need to sign in before joining.')).toBeTruthy();

      fireEvent.press(getByText('Sign In'));
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
    it('shows a loading spinner until the invite GET resolves', async () => {
      let resolveGet: ((v: { data: { album_name: string } }) => void) | undefined;
      mockApi.get.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGet = resolve;
          }),
      );

      const { UNSAFE_queryAllByType, queryByText } = render(<JoinScreen />);

      const { ActivityIndicator } = require('react-native');
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
      expect(queryByText("You're invited!")).toBeNull();

      await act(async () => {
        resolveGet!({ data: { album_name: 'Emma Album' } });
      });

      await waitFor(() => {
        expect(queryByText("You're invited!")).toBeTruthy();
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
      expect(getByText("You're invited!")).toBeTruthy();
      expect(getByText('Join Album')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
    });

    it('alerts "Invalid invite" when the invite fetch fails (404/410)', async () => {
      const err: any = new Error('not found');
      err.response = { status: 404 };
      mockApi.get.mockRejectedValueOnce(err);

      render(<JoinScreen />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Invalid invite',
          'This invite link is invalid or expired.',
        );
      });
    });

    it('posts to /invites/:token/join and replaces to /(tabs) on success', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });
      mockApi.post.mockResolvedValueOnce({ data: {} });

      const { getByText } = render(<JoinScreen />);

      await waitFor(() => {
        expect(getByText('Join Album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Join Album'));
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
        expect(getByText('Join Album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Join Album'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'Already a member');
      });
      expect(mockRouter.replace).not.toHaveBeenCalled();
    });

    it('falls back to error.message when no server payload is returned', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });
      mockApi.post.mockRejectedValueOnce(new Error('boom'));

      const { getByText } = render(<JoinScreen />);
      await waitFor(() => {
        expect(getByText('Join Album')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.press(getByText('Join Album'));
      });

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Error', 'boom');
      });
    });

    it('navigates back when the Cancel button is pressed', async () => {
      mockApi.get.mockResolvedValueOnce({ data: { album_name: 'Emma Album' } });

      const { getByText } = render(<JoinScreen />);
      await waitFor(() => {
        expect(getByText('Cancel')).toBeTruthy();
      });

      fireEvent.press(getByText('Cancel'));
      expect(mockRouter.back).toHaveBeenCalled();
    });
  });
});
