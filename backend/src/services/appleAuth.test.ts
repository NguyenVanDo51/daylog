jest.mock('apple-signin-auth');

import appleSignin from 'apple-signin-auth';
import { verifyAppleToken } from './appleAuth';

const mockVerify = appleSignin.verifyIdToken as jest.Mock;

describe('verifyAppleToken', () => {
  const originalClientId = process.env.APPLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APPLE_CLIENT_ID = 'com.test.apple.client';
  });

  afterAll(() => {
    if (originalClientId === undefined) {
      delete process.env.APPLE_CLIENT_ID;
    } else {
      process.env.APPLE_CLIENT_ID = originalClientId;
    }
  });

  it('calls verifyIdToken with audience from env and ignoreExpiration:false, returns mapped fields', async () => {
    mockVerify.mockResolvedValue({
      sub: 'apple-sub-123',
      name: 'Jane Apple',
      email: 'jane@apple.example',
    });

    const result = await verifyAppleToken('id-token-value');

    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledWith('id-token-value', {
      audience: 'com.test.apple.client',
      ignoreExpiration: false,
    });
    expect(result).toEqual({
      sub: 'apple-sub-123',
      name: 'Jane Apple',
      email: 'jane@apple.example',
    });
  });

  it('returns name:null when payload has no name, and email:null when payload has no email', async () => {
    mockVerify.mockResolvedValueOnce({ sub: 'sub-no-name', email: 'someone@apple.example' });
    const noName = await verifyAppleToken('token-1');
    expect(noName).toEqual({
      sub: 'sub-no-name',
      name: null,
      email: 'someone@apple.example',
    });

    mockVerify.mockResolvedValueOnce({ sub: 'sub-no-email', name: 'No Email User' });
    const noEmail = await verifyAppleToken('token-2');
    expect(noEmail).toEqual({
      sub: 'sub-no-email',
      name: 'No Email User',
      email: null,
    });
  });

  it('propagates the error when verifyIdToken rejects', async () => {
    const boom = new Error('apple verify failed');
    mockVerify.mockRejectedValue(boom);

    await expect(verifyAppleToken('bad-token')).rejects.toThrow('apple verify failed');
  });
});
