import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    Ionicons: React.forwardRef((props: any, ref: any) =>
      React.createElement(View, { ...props, ref, testID: props.testID ?? props.name }),
    ),
  };
});

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(() => ({ albumId: 'album-1', date: '2026-06-08' })),
  router: { back: jest.fn(), push: jest.fn() },
}));

const mockDeleteMutate = jest.fn().mockResolvedValue(undefined);
const mockUpdateMutate = jest.fn().mockResolvedValue(undefined);

jest.mock('@/hooks/usePhotoActions', () => ({
  useDeletePhoto: jest.fn(() => ({ mutateAsync: mockDeleteMutate })),
  useUpdateCaption: jest.fn(() => ({ mutateAsync: mockUpdateMutate })),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({
      token: 'tok',
      user: { id: 'user-1', display_name: 'Me', email: 'me@test.com', avatar_url: null },
    })
  ),
}));

jest.mock('@/hooks/useDayPhotos', () => ({
  useDayPhotos: jest.fn(() => ({
    data: [
      {
        id: 'photo-1',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T08:00:00.000Z',
        caption: 'Sáng sớm',
        uploaded_by: 'user-1',
      },
      {
        id: 'photo-2',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T12:00:00.000Z',
        caption: null,
        uploaded_by: 'user-2',
      },
    ],
    isLoading: false,
  })),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/lib/i18n', () => ({
  t: (key: string, params?: any) => {
    const map: Record<string, string> = {
      'manage.title':                'Quản lý ngày {{date}}',
      'manage.note_ph':              'Thêm ghi chú...',
      'manage.delete_confirm_title': 'Xoá ảnh?',
      'manage.delete_confirm_body':  'Ảnh sẽ bị xoá vĩnh viễn.',
      'manage.delete':               'Xoá',
      'manage.cancel':               'Huỷ',
      'manage.save_error':           'Không thể lưu ghi chú',
      'manage.delete_error':         'Không thể xoá ảnh',
    };
    let str = map[key] ?? key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(`{{${k}}}`, String(v));
      });
    }
    return str;
  },
}));

import { router } from 'expo-router';
import { useDayPhotos } from '@/hooks/useDayPhotos';
import ManageScreen from '../story/[albumId]/[date]/manage';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ManageScreen', () => {
  it('renders a list item for each photo', () => {
    const { getAllByTestId } = render(<ManageScreen />);
    expect(getAllByTestId(/^manage-item-/)).toHaveLength(2);
  });

  it('shows delete button only for photos uploaded by current user', () => {
    const { getByTestId, queryByTestId } = render(<ManageScreen />);
    expect(getByTestId('delete-photo-1')).toBeTruthy();
    expect(queryByTestId('delete-photo-2')).toBeNull();
  });

  it('shows editable note input for own photo, read-only text for others', () => {
    const { getByTestId, queryByTestId } = render(<ManageScreen />);
    expect(getByTestId('note-input-photo-1')).toBeTruthy();
    expect(queryByTestId('note-input-photo-2')).toBeNull();
    expect(getByTestId('note-readonly-photo-2')).toBeTruthy();
  });

  it('shows confirmation Alert on delete press', () => {
    const spy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<ManageScreen />);
    fireEvent.press(getByTestId('delete-photo-1'));
    expect(spy).toHaveBeenCalledWith(
      'Xoá ảnh?',
      'Ảnh sẽ bị xoá vĩnh viễn.',
      expect.any(Array)
    );
  });

  it('navigates back when last remaining photo is deleted', async () => {
    (useDayPhotos as jest.Mock).mockReturnValueOnce({
      data: [{
        id: 'photo-1',
        media_type: 'photo',
        duration_ms: null,
        taken_at: '2026-06-08T08:00:00.000Z',
        caption: null,
        uploaded_by: 'user-1',
      }],
      isLoading: false,
    });

    const spy = jest.spyOn(Alert, 'alert');
    const { getByTestId } = render(<ManageScreen />);
    fireEvent.press(getByTestId('delete-photo-1'));

    const buttons = (spy.mock.calls[0] as any[])[2] as Array<{ text: string; onPress?: () => Promise<void> }>;
    const deleteBtn = buttons.find((b) => b.text === 'Xoá');
    await deleteBtn!.onPress!();

    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });
});
