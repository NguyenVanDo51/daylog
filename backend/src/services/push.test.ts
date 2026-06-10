jest.mock('expo-server-sdk', () => {
  const mockSend = jest.fn().mockResolvedValue([{ status: 'ok', id: 'receipt-id' }]);
  const mockChunk = jest.fn().mockImplementation((msgs: unknown[]) => [msgs]);
  const MockExpo = jest.fn().mockImplementation(() => ({
    sendPushNotificationsAsync: mockSend,
    chunkPushNotifications: mockChunk,
  }));
  (MockExpo as any).isExpoPushToken = jest.fn().mockReturnValue(true);
  return {
    Expo: MockExpo,
    __mockSend: mockSend,
    __mockChunk: mockChunk,
    __mockIsValid: (MockExpo as any).isExpoPushToken,
  };
});

jest.mock('../db', () => {
  const mockWhere = jest.fn().mockResolvedValue(undefined);
  const mockSet = jest.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = jest.fn().mockReturnValue({ set: mockSet });
  return { db: { update: mockUpdate }, __mockUpdate: mockUpdate, __mockWhere: mockWhere };
});

jest.mock('../db/schema', () => ({ users: { pushToken: 'pushToken' } }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn() }));

type ExpoMock = {
  Expo: jest.Mock;
  __mockSend: jest.Mock;
  __mockChunk: jest.Mock;
  __mockIsValid: jest.Mock;
};
type DbMock = { db: { update: jest.Mock }; __mockUpdate: jest.Mock; __mockWhere: jest.Mock };

describe('services/push sendPush', () => {
  let expo: ExpoMock;
  let dbMock: DbMock;
  let sendPush: (
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => Promise<void>;

  beforeEach(() => {
    jest.clearAllMocks();
    expo = require('expo-server-sdk') as ExpoMock;
    dbMock = require('../db') as DbMock;
    expo.__mockSend.mockResolvedValue([{ status: 'ok', id: 'receipt-id' }]);
    expo.__mockChunk.mockImplementation((msgs: unknown[]) => [msgs]);
    expo.__mockIsValid.mockReturnValue(true);
    ({ sendPush } = require('./push'));
  });

  it('returns early and does not send when token array is empty', async () => {
    await sendPush([], 'T', 'B');
    expect(expo.__mockSend).not.toHaveBeenCalled();
  });

  it('filters out invalid tokens and returns early when none remain', async () => {
    expo.__mockIsValid.mockReturnValue(false);
    await sendPush(['not-an-expo-token'], 'T', 'B');
    expect(expo.__mockSend).not.toHaveBeenCalled();
  });

  it('sends notification with correct fields', async () => {
    await sendPush(['ExponentPushToken[xxx]'], 'Ảnh mới', 'Có ảnh mới', { photoId: '123' });
    expect(expo.__mockChunk).toHaveBeenCalledWith([
      { to: 'ExponentPushToken[xxx]', title: 'Ảnh mới', body: 'Có ảnh mới', data: { photoId: '123' } },
    ]);
    expect(expo.__mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses empty data object by default', async () => {
    await sendPush(['ExponentPushToken[yyy]'], 'T', 'B');
    expect(expo.__mockChunk).toHaveBeenCalledWith([
      { to: 'ExponentPushToken[yyy]', title: 'T', body: 'B', data: {} },
    ]);
  });

  it('clears push token in DB on DeviceNotRegistered error', async () => {
    expo.__mockSend.mockResolvedValueOnce([
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);
    expo.__mockChunk.mockReturnValueOnce([
      [{ to: 'ExponentPushToken[stale]', title: 'T', body: 'B', data: {} }],
    ]);

    await sendPush(['ExponentPushToken[stale]'], 'T', 'B');

    const { eq } = require('drizzle-orm') as { eq: jest.Mock };
    expect(dbMock.__mockUpdate).toHaveBeenCalled();
    expect(dbMock.__mockWhere).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith(expect.anything(), 'ExponentPushToken[stale]');
  });

  it('does not update DB when ticket status is ok', async () => {
    await sendPush(['ExponentPushToken[good]'], 'T', 'B');
    expect(dbMock.__mockUpdate).not.toHaveBeenCalled();
  });
});
