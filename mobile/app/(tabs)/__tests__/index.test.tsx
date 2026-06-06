jest.mock('@/hooks/useAlbums', () => ({
  useAlbums: jest.fn(),
}));

jest.mock('@/stores/albumStore', () => ({
  useAlbumStore: jest.fn((selector) =>
    selector({ setAlbum: jest.fn() }),
  ),
}));

import React from 'react';
import { render } from '@testing-library/react-native';
import Screen from '../index';
import { useAlbums } from '@/hooks/useAlbums';

const mockUseAlbums = useAlbums as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AlbumsScreen', () => {
  it('shows a loading spinner when useAlbums is loading', () => {
    mockUseAlbums.mockReturnValue({ data: undefined, isLoading: true });
    const { UNSAFE_getByType } = render(<Screen />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders album names when data is loaded', () => {
    mockUseAlbums.mockReturnValue({
      data: [
        { id: '1', name: 'My Album', is_private: false, child_birthdate: null, cover_photo_id: null, created_by: 'u1', created_at: '' },
      ],
      isLoading: false,
    });
    const { getByText } = render(<Screen />);
    expect(getByText('My Album')).toBeTruthy();
  });

  it('shows private badge for private albums', () => {
    mockUseAlbums.mockReturnValue({
      data: [
        { id: '1', name: 'Private Album', is_private: true, child_birthdate: null, cover_photo_id: null, created_by: 'u1', created_at: '' },
      ],
      isLoading: false,
    });
    const { getByText } = render(<Screen />);
    // Vietnamese locale: albums.private = 'Cá nhân'
    expect(getByText('Cá nhân')).toBeTruthy();
  });

  it('renders private album before shared album when both exist', () => {
    mockUseAlbums.mockReturnValue({
      data: [
        { id: 'shared', name: 'Shared Album', is_private: false, child_birthdate: null, cover_photo_id: null, created_by: 'u1', created_at: '' },
        { id: 'priv', name: 'Private Album', is_private: true, child_birthdate: null, cover_photo_id: null, created_by: 'u1', created_at: '' },
      ],
      isLoading: false,
    });
    const { getAllByText } = render(<Screen />);
    // Use exact album names to avoid matching the heading text
    const allNames = getAllByText(/^(Private|Shared) Album$/);
    // Private album should appear first in the rendered list
    expect(allNames[0].props.children).toBe('Private Album');
    expect(allNames[1].props.children).toBe('Shared Album');
  });
});
