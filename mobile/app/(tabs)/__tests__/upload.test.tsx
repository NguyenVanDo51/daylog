jest.mock('@/lib/api', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: (sel: any) =>
    sel({ albumId: 'album-1', albumName: 'Test', setAlbum: jest.fn() }),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: (sel?: any) =>
    sel ? sel({ user: { id: 'u1', display_name: 'Me' }, token: 'jwt', clearAuth: jest.fn() }) : { getState: () => ({ token: 'jwt' }) },
}));

import React from 'react';
import { View } from 'react-native';
import { render } from '@testing-library/react-native';
import Screen from '../upload';

describe('UploadTab', () => {
  it('renders a placeholder view (never rendered as a real screen — the FAB opens UploadSheet)', () => {
    const { UNSAFE_getAllByType } = render(<Screen />);
    // The component returns a single empty <View />.
    expect(UNSAFE_getAllByType(View).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render any children', () => {
    const { toJSON } = render(<Screen />);
    const tree = toJSON();
    // The root is a single empty View with no children.
    expect(tree).toBeTruthy();
    if (tree && !Array.isArray(tree)) {
      expect(tree.type).toBe('View');
      expect(tree.children).toBeNull();
    }
  });
});
