import { usePendingUploadStore } from '@/stores/pendingUploadStore';

beforeEach(() => {
  usePendingUploadStore.setState({ pendingPhotos: [] });
});

describe('pendingUploadStore', () => {
  it('starts empty', () => {
    expect(usePendingUploadStore.getState().pendingPhotos).toEqual([]);
  });

  it('addPending adds photos with uploading status', () => {
    usePendingUploadStore.getState().addPending([
      { id: 'a', localUri: 'file://a.jpg' },
      { id: 'b', localUri: 'file://b.jpg' },
    ]);
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos).toHaveLength(2);
    expect(photos[0]).toEqual({ id: 'a', localUri: 'file://a.jpg', status: 'uploading' });
    expect(photos[1]).toEqual({ id: 'b', localUri: 'file://b.jpg', status: 'uploading' });
  });

  it('addPending appends to existing photos', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [{ id: 'x', localUri: 'file://x.jpg', status: 'uploading' as const }],
    });
    usePendingUploadStore.getState().addPending([{ id: 'y', localUri: 'file://y.jpg' }]);
    expect(usePendingUploadStore.getState().pendingPhotos).toHaveLength(2);
  });

  it('markDone sets status to done for matching id only', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'uploading' as const },
        { id: 'b', localUri: 'file://b.jpg', status: 'uploading' as const },
      ],
    });
    usePendingUploadStore.getState().markDone('a');
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos[0].status).toBe('done');
    expect(photos[1].status).toBe('uploading');
  });

  it('markError sets status to error for matching id only', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'uploading' as const },
        { id: 'b', localUri: 'file://b.jpg', status: 'uploading' as const },
      ],
    });
    usePendingUploadStore.getState().markError('a');
    const photos = usePendingUploadStore.getState().pendingPhotos;
    expect(photos[0].status).toBe('error');
    expect(photos[1].status).toBe('uploading');
  });

  it('clearAll empties the list', () => {
    usePendingUploadStore.setState({
      pendingPhotos: [
        { id: 'a', localUri: 'file://a.jpg', status: 'done' as const },
      ],
    });
    usePendingUploadStore.getState().clearAll();
    expect(usePendingUploadStore.getState().pendingPhotos).toEqual([]);
  });
});
