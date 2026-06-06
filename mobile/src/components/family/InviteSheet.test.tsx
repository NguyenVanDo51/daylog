jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));
jest.mock('@/lib/haptics', () => ({ success: jest.fn(), tap: jest.fn() }));

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
  mockClipboard.setStringAsync.mockResolvedValue(true);
  mockUseAlbumStore.mockImplementation((selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: 'album-42' }),
  );
  mockApi.post.mockResolvedValue({ data: { token: 'tok-default' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('InviteSheet', () => {
  it('renders heading, body and action buttons when visible', async () => {
    const { getByText } = render(<InviteSheet visible={true} onClose={jest.fn()} />);
    // Wait for API to resolve and loading to clear before asserting button labels
    await waitFor(() => expect(mockApi.post).toHaveBeenCalled());
    expect(getByText('Mời gia đình')).toBeTruthy();
    await waitFor(() => expect(getByText('Sao chép link mời')).toBeTruthy());
    expect(getByText('Xong')).toBeTruthy();
  });

  it('calls onClose when Done (Xong) is pressed', async () => {
    const onClose = jest.fn();
    const { getByText } = render(<InviteSheet visible={true} onClose={onClose} />);
    await waitFor(() => expect(mockApi.post).toHaveBeenCalled());
    await waitFor(() => getByText('Xong'));
    fireEvent.press(getByText('Xong'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('fetches invite link on open and copies it when copy button pressed', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: 'tok-123' } });
    const { getByText } = render(<InviteSheet visible={true} onClose={jest.fn()} />);

    // API called on mount
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/albums/album-42/invites');
    });

    // Pressing copy should not call API again, just copy the resolved link
    fireEvent.press(getByText('Sao chép link mời'));
    await waitFor(() => {
      expect(mockClipboard.setStringAsync).toHaveBeenCalledWith('familyguy://join/tok-123');
    });
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Đã sao chép!', 'Đã sao chép link mời vào bộ nhớ tạm.');
    });
  });

  it('shows loading indicator while fetching on open', async () => {
    let resolvePost: ((v: { data: { token: string } }) => void) | undefined;
    mockApi.post.mockImplementationOnce(
      () => new Promise((resolve) => { resolvePost = resolve; }),
    );

    const { UNSAFE_queryAllByType } = render(
      <InviteSheet visible={true} onClose={jest.fn()} />,
    );

    const { ActivityIndicator } = require('react-native');
    await waitFor(() => {
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    });

    await act(async () => { resolvePost!({ data: { token: 'tok-loading' } }); });

    await waitFor(() => {
      expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBe(0);
    });
  });

  it('shows an error alert when api.post rejects on open', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('boom'));
    render(<InviteSheet visible={true} onClose={jest.fn()} />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Có lỗi xảy ra', 'boom');
    });
    expect(mockClipboard.setStringAsync).not.toHaveBeenCalled();
  });
});
