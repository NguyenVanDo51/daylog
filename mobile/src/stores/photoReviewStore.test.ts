import { usePhotoReviewStore, type ReviewAsset } from '@/stores/photoReviewStore';

beforeEach(() => {
  usePhotoReviewStore.setState({ assets: [] });
});

describe('usePhotoReviewStore', () => {
  test('starts with an empty assets array', () => {
    expect(usePhotoReviewStore.getState().assets).toEqual([]);
  });

  test('setAssets replaces the current array', () => {
    const a: ReviewAsset = { uri: 'file:///a.webp', type: 'photo', source: 'camera' };
    const b: ReviewAsset = {
      uri: 'file:///b.mp4',
      type: 'video',
      source: 'gallery',
      durationMs: 2000,
      takenAt: '2026-06-13T10:00:00Z',
      localAssetId: 'ph-1',
    };
    usePhotoReviewStore.getState().setAssets([a]);
    expect(usePhotoReviewStore.getState().assets).toEqual([a]);
    usePhotoReviewStore.getState().setAssets([b]);
    expect(usePhotoReviewStore.getState().assets).toEqual([b]);
  });

  test('clear empties the assets array', () => {
    usePhotoReviewStore.getState().setAssets([
      { uri: 'file:///a', type: 'photo', source: 'camera' },
    ]);
    usePhotoReviewStore.getState().clear();
    expect(usePhotoReviewStore.getState().assets).toEqual([]);
  });
});
