jest.mock('google-auth-library', () => {
  const verifyIdToken = jest.fn();
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken })),
    __verifyIdToken: verifyIdToken,
  };
});

import * as googleLib from 'google-auth-library';
import { verifyGoogleToken } from './googleAuth';

const mockVerify = (googleLib as unknown as { __verifyIdToken: jest.Mock }).__verifyIdToken;

describe('verifyGoogleToken', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = 'google-client-id.test';
  });

  afterAll(() => {
    if (originalClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  it('returns mapped {sub, name, picture} from ticket.getPayload()', async () => {
    mockVerify.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        name: 'Jane Google',
        picture: 'https://example.com/jane.png',
      }),
    });

    const result = await verifyGoogleToken('google-id-token');

    expect(mockVerify).toHaveBeenCalledTimes(1);
    expect(mockVerify).toHaveBeenCalledWith({
      idToken: 'google-id-token',
      audience: 'google-client-id.test',
    });
    expect(result).toEqual({
      sub: 'google-sub-123',
      name: 'Jane Google',
      picture: 'https://example.com/jane.png',
    });
  });

  it('returns name:null when missing, and picture:null when missing', async () => {
    mockVerify.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'sub-no-name', picture: 'https://example.com/x.png' }),
    });
    const noName = await verifyGoogleToken('token-1');
    expect(noName).toEqual({
      sub: 'sub-no-name',
      name: null,
      picture: 'https://example.com/x.png',
    });

    mockVerify.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'sub-no-picture', name: 'No Picture User' }),
    });
    const noPicture = await verifyGoogleToken('token-2');
    expect(noPicture).toEqual({
      sub: 'sub-no-picture',
      name: 'No Picture User',
      picture: null,
    });
  });

  it('rejects when verifyIdToken rejects', async () => {
    const boom = new Error('google verify failed');
    mockVerify.mockRejectedValue(boom);

    await expect(verifyGoogleToken('bad-token')).rejects.toThrow('google verify failed');
  });
});
