jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import { InviteSheet } from '@/components/family/InviteSheet';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;
const mockClipboard = Clipboard as jest.Mocked<typeof Clipboard>;

beforeEach(() => {
  jest.clearAllMocks();
  // Re-establish the global clipboard mock resolution (clearAllMocks wipes the
  // resolved value set in jest.setup.js).
  mockClipboard.setStringAsync.mockResolvedValue(true);
  mockUseAlbumStore.mockImplementation((selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: 'album-42' }),
  );
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('InviteSheet', () => {
  it('renders heading, body and action buttons when visible', () => {
    const onClose = jest.fn();
    const { getByText } = render(<InviteSheet visible={true} onClose={onClose} />);
    expect(getByText(/Invite Family/)).toBeTruthy();
    expect(getByText(/Share an invite link/)).toBeTruthy();
    expect(getByText('Copy Invite Link')).toBeTruthy();
    expect(getByText('Done')).toBeTruthy();
  });

  it('calls onClose when Done is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(<InviteSheet visible={true} onClose={onClose} />);
    fireEvent.press(getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('posts to /albums/:id/invites and copies the deep link to clipboard', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: 'tok-123' } });
    const onClose = jest.fn();
    const { getByText } = render(<InviteSheet visible={true} onClose={onClose} />);

    fireEvent.press(getByText('Copy Invite Link'));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/albums/album-42/invites');
    });
    await waitFor(() => {
      expect(mockClipboard.setStringAsync).toHaveBeenCalledWith('familyguy://join/tok-123');
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Copied!', 'Invite link copied to clipboard.');
    });
  });

  it('shows a loading indicator while the request is in flight', async () => {
    let resolvePost: ((v: { data: { token: string } }) => void) | undefined;
    mockApi.post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolvePost = resolve;
        }),
    );

    const { getByText, UNSAFE_queryAllByType } = render(
      <InviteSheet visible={true} onClose={jest.fn()} />,
    );

    fireEvent.press(getByText('Copy Invite Link'));

    // While loading, the button label is replaced with an ActivityIndicator.
    const { ActivityIndicator } = require('react-native');
    await waitFor(() => {
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    });

    await act(async () => {
      resolvePost!({ data: { token: 'tok-loading' } });
    });

    await waitFor(() => {
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(0);
    });
  });

  it('shows an error alert when api.post rejects', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('boom'));
    const { getByText } = render(<InviteSheet visible={true} onClose={jest.fn()} />);

    fireEvent.press(getByText('Copy Invite Link'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'boom');
    });
    expect(mockClipboard.setStringAsync).not.toHaveBeenCalled();
  });
});
