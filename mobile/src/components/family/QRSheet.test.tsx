jest.mock('@/lib/api', () => ({
  api: { post: jest.fn() },
}));
jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn(),
}));
jest.mock('@/lib/haptics', () => ({ success: jest.fn(), tap: jest.fn() }));

// Override the global expo-camera mock so we can control permission state and
// capture the onBarcodeScanned prop passed to CameraView.
jest.mock('expo-camera', () => {
  const React = require('react');
  const mockRequestPermission = jest.fn();
  const cameraViewProps: { current: any } = { current: null };
  const permissionState: { current: { granted: boolean } | null } = {
    current: { granted: true },
  };
  return {
    __esModule: true,
    __setPermission: (p: { granted: boolean } | null) => {
      permissionState.current = p;
    },
    __getCameraViewProps: () => cameraViewProps.current,
    __mockRequestPermission: mockRequestPermission,
    CameraView: (props: any) => {
      cameraViewProps.current = props;
      return React.createElement('CameraView', props);
    },
    useCameraPermissions: () => [permissionState.current, mockRequestPermission],
  };
});

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QRSheet } from '@/components/family/QRSheet';
import { api } from '@/lib/api';
import { useAlbumStore } from '@/stores/albumStore';

const expoCamera = require('expo-camera') as {
  __setPermission: (p: { granted: boolean } | null) => void;
  __getCameraViewProps: () => any;
  __mockRequestPermission: jest.Mock;
};

const mockApi = api as jest.Mocked<typeof api>;
const mockUseAlbumStore = useAlbumStore as unknown as jest.Mock;

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  expoCamera.__setPermission({ granted: true });
  mockUseAlbumStore.mockImplementation((selector: (s: { albumId: string | null }) => unknown) =>
    selector({ albumId: 'album-42' }),
  );
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('QRSheet', () => {
  it('renders the sheet without camera content when permission state is not yet resolved', () => {
    expoCamera.__setPermission(null);
    const { queryByText } = render(
      <QRSheet visible={true} onClose={jest.fn()} />,
      { wrapper: makeWrapper() },
    );
    // No camera UI or permission UI shown while permission is resolving.
    expect(queryByText('Cần quyền camera')).toBeNull();
    expect(queryByText('quét mã này nhé ✦')).toBeNull();
  });

  it('shows the permission fallback UI when permission is denied', () => {
    expoCamera.__setPermission({ granted: false });
    const onClose = jest.fn();
    const { getByText } = render(
      <QRSheet visible={true} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );

    // Vietnamese permission UI
    expect(getByText('Cần quyền camera')).toBeTruthy();
    expect(getByText('Camera dùng để quét mã QR mời.')).toBeTruthy();

    fireEvent.press(getByText('Cho phép'));
    expect(expoCamera.__mockRequestPermission).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('Huỷ'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the scanner heading and CameraView when permission is granted', () => {
    const { getByText } = render(
      <QRSheet visible={true} onClose={jest.fn()} />,
      { wrapper: makeWrapper() },
    );
    // Vietnamese heading
    expect(getByText('quét mã này nhé ✦')).toBeTruthy();
    const cameraProps = expoCamera.__getCameraViewProps();
    expect(cameraProps).toBeTruthy();
    expect(typeof cameraProps.onBarcodeScanned).toBe('function');
    expect(cameraProps.barcodeScannerSettings).toEqual({ barcodeTypes: ['qr'] });
  });

  it('calls onClose when the Cancel (Huỷ) button is pressed', () => {
    const onClose = jest.fn();
    const { getByText } = render(
      <QRSheet visible={true} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.press(getByText('Huỷ'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('joins the album when a valid familyguy:// QR code is scanned', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });
    const onClose = jest.fn();
    render(<QRSheet visible={true} onClose={onClose} />, { wrapper: makeWrapper() });

    const cameraProps = expoCamera.__getCameraViewProps();
    await act(async () => {
      await cameraProps.onBarcodeScanned({ data: 'familyguy://join/abc-token' });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/invites/abc-token/join');
    await waitFor(() => {
      // Vietnamese joined alert
      expect(Alert.alert).toHaveBeenCalledWith('Đã tham gia!', 'Bạn đã tham gia album.');
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('accepts a bare token (no scheme) as the scanned value', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} });
    render(<QRSheet visible={true} onClose={jest.fn()} />, { wrapper: makeWrapper() });

    const cameraProps = expoCamera.__getCameraViewProps();
    await act(async () => {
      await cameraProps.onBarcodeScanned({ data: 'plain-token' });
    });

    expect(mockApi.post).toHaveBeenCalledWith('/invites/plain-token/join');
  });

  it('ignores subsequent scans once one has been processed', async () => {
    mockApi.post.mockResolvedValue({ data: {} });
    render(<QRSheet visible={true} onClose={jest.fn()} />, { wrapper: makeWrapper() });

    await act(async () => {
      await expoCamera.__getCameraViewProps().onBarcodeScanned({
        data: 'familyguy://join/first',
      });
    });
    await act(async () => {
      await expoCamera.__getCameraViewProps().onBarcodeScanned({
        data: 'familyguy://join/second',
      });
    });

    expect(mockApi.post).toHaveBeenCalledTimes(1);
    expect(mockApi.post).toHaveBeenCalledWith('/invites/first/join');
  });

  it('shows an error alert and re-arms scanning when the join request fails', async () => {
    mockApi.post.mockRejectedValueOnce({ response: { data: { error: 'invite expired' } } });
    const onClose = jest.fn();
    render(<QRSheet visible={true} onClose={onClose} />, { wrapper: makeWrapper() });

    const cameraProps = expoCamera.__getCameraViewProps();
    await act(async () => {
      await cameraProps.onBarcodeScanned({ data: 'familyguy://join/bad-token' });
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Có lỗi xảy ra', 'invite expired');
    });
    expect(onClose).not.toHaveBeenCalled();

    mockApi.post.mockResolvedValueOnce({ data: {} });
    await act(async () => {
      await cameraProps.onBarcodeScanned({ data: 'familyguy://join/retry-token' });
    });
    expect(mockApi.post).toHaveBeenLastCalledWith('/invites/retry-token/join');
  });

  it('falls back to error.message when no response.data.error is present', async () => {
    const err = Object.assign(new Error('network down'), { response: undefined });
    mockApi.post.mockRejectedValueOnce(err);
    render(<QRSheet visible={true} onClose={jest.fn()} />, { wrapper: makeWrapper() });

    const cameraProps = expoCamera.__getCameraViewProps();
    await act(async () => {
      await cameraProps.onBarcodeScanned({ data: 'familyguy://join/tok' });
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Có lỗi xảy ra', 'network down');
    });
  });
});
