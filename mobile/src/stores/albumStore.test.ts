import { useAlbumStore } from '@/stores/albumStore';

beforeEach(() => {
  useAlbumStore.setState({ albumId: null, albumName: null, childBirthdate: null });
});

describe('albumStore', () => {
  it('starts empty', () => {
    expect(useAlbumStore.getState().albumId).toBeNull();
  });

  it('setAlbum stores album info', () => {
    useAlbumStore.getState().setAlbum({ id: 'abc', name: "Emma's Album", child_birthdate: '2025-04-01' });
    expect(useAlbumStore.getState().albumId).toBe('abc');
    expect(useAlbumStore.getState().albumName).toBe("Emma's Album");
  });

  it('clearAlbum resets', () => {
    useAlbumStore.setState({ albumId: 'abc', albumName: 'test', childBirthdate: '2025-01-01' });
    useAlbumStore.getState().clearAlbum();
    expect(useAlbumStore.getState().albumId).toBeNull();
  });
});
