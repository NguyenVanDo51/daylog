jest.mock('../services/r2', () => ({
  getPresignedGetUrl: jest.fn(),
}));

import { resolveAvatarUrl } from './mediaUtils';
import { getPresignedGetUrl } from '../services/r2';

const mockGetPresignedGetUrl = getPresignedGetUrl as jest.MockedFunction<typeof getPresignedGetUrl>;

beforeEach(() => {
  mockGetPresignedGetUrl.mockReset();
});

describe('resolveAvatarUrl', () => {
  it('returns null when url is null', async () => {
    expect(await resolveAvatarUrl(null)).toBeNull();
    expect(mockGetPresignedGetUrl).not.toHaveBeenCalled();
  });

  it('returns the url unchanged when it is already an https URL', async () => {
    const u = 'https://cdn.example.com/avatars/abc.png';
    expect(await resolveAvatarUrl(u)).toBe(u);
    expect(mockGetPresignedGetUrl).not.toHaveBeenCalled();
  });

  it('presigns an R2 key (non-https) with a 1 hour TTL', async () => {
    mockGetPresignedGetUrl.mockResolvedValueOnce('https://r2.signed/key?sig=xyz');
    const out = await resolveAvatarUrl('avatars/u-123.png');
    expect(out).toBe('https://r2.signed/key?sig=xyz');
    expect(mockGetPresignedGetUrl).toHaveBeenCalledWith('avatars/u-123.png', 3600);
  });
});
