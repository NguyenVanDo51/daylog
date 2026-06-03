jest.mock('@parse/node-apn', () => {
  const mockSend = jest.fn().mockResolvedValue({ sent: [], failed: [] });
  return {
    Provider: jest.fn().mockImplementation(() => ({ send: mockSend, shutdown: jest.fn() })),
    Notification: jest.fn().mockImplementation(() => ({})),
    __mockSend: mockSend,
  };
});

type MockedApn = {
  Provider: jest.Mock;
  Notification: jest.Mock;
  __mockSend: jest.Mock;
};

describe('services/apns sendPush', () => {
  const ORIGINAL_ENV = { ...process.env };
  let apn: MockedApn;
  let sendPush: (
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>
  ) => Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.APNS_KEY = 'line1\\nline2';
    process.env.APNS_KEY_ID = 'KEYID123';
    process.env.APNS_TEAM_ID = 'TEAMID123';
    process.env.APNS_BUNDLE_ID = 'com.example.app';
    process.env.NODE_ENV = 'test';

    // Re-require to get a fresh module-level `provider` singleton per test.
    apn = require('@parse/node-apn') as unknown as MockedApn;
    apn.Provider.mockClear();
    apn.Notification.mockClear();
    apn.__mockSend.mockClear();
    apn.__mockSend.mockResolvedValue({ sent: [], failed: [] });
    ({ sendPush } = require('./apns'));
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns early and does not create provider when token array is empty', async () => {
    await sendPush([], 'T', 'B');
    expect(apn.Provider).not.toHaveBeenCalled();
    expect(apn.Notification).not.toHaveBeenCalled();
    expect(apn.__mockSend).not.toHaveBeenCalled();
  });

  it('builds notification and calls provider.send with note + tokens', async () => {
    const before = Math.floor(Date.now() / 1000);
    await sendPush(['tok1'], 'Hi', 'body', { foo: 1 });
    const after = Math.floor(Date.now() / 1000);

    expect(apn.Notification).toHaveBeenCalledTimes(1);
    // grab the note instance returned by the Notification mock
    const note = apn.Notification.mock.results[0].value;
    expect(note.alert).toEqual({ title: 'Hi', body: 'body' });
    expect(note.payload).toEqual({ foo: 1 });
    expect(note.topic).toBe('com.example.app');
    expect(note.expiry).toBeGreaterThanOrEqual(before + 3600);
    expect(note.expiry).toBeLessThanOrEqual(after + 3600);

    expect(apn.Provider).toHaveBeenCalledTimes(1);
    // verify provider construction args (non-production by default, key newline-replaced)
    expect(apn.Provider).toHaveBeenCalledWith({
      token: {
        key: 'line1\nline2',
        keyId: 'KEYID123',
        teamId: 'TEAMID123',
      },
      production: false,
    });

    expect(apn.__mockSend).toHaveBeenCalledTimes(1);
    expect(apn.__mockSend).toHaveBeenCalledWith(note, ['tok1']);
  });

  it('reuses the same Provider across multiple sendPush calls (singleton)', async () => {
    await sendPush(['tok1'], 'a', 'b');
    await sendPush(['tok2'], 'c', 'd', { x: 2 });

    expect(apn.Provider).toHaveBeenCalledTimes(1);
    expect(apn.Notification).toHaveBeenCalledTimes(2);
    expect(apn.__mockSend).toHaveBeenCalledTimes(2);
  });

  it('uses default empty data param when not provided', async () => {
    await sendPush(['tokOnly'], 'title', 'bod');
    const note = apn.Notification.mock.results[0].value;
    expect(note.payload).toEqual({});
  });

  it('handles missing APNS_KEY gracefully (replace on empty string)', async () => {
    jest.resetModules();
    delete process.env.APNS_KEY;
    const apnLocal = require('@parse/node-apn') as unknown as MockedApn;
    apnLocal.Provider.mockClear();
    apnLocal.__mockSend.mockClear();
    const { sendPush: sendPushLocal } = require('./apns');
    await sendPushLocal(['t'], 'a', 'b');
    expect(apnLocal.Provider).toHaveBeenCalledWith(
      expect.objectContaining({ token: expect.objectContaining({ key: '' }) })
    );
  });

  it('passes production:true when NODE_ENV=production', () => {
    jest.resetModules();
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    return new Promise<void>((resolve, reject) => {
      jest.isolateModules(() => {
        const apnMock = {
          Provider: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
          Notification: jest.fn().mockImplementation(() => ({})),
        };
        jest.doMock('@parse/node-apn', () => apnMock);
        const { sendPush: sendPushProd } = require('./apns');
        sendPushProd(['t'], 'a', 'b')
          .then(() => {
            try {
              expect(apnMock.Provider).toHaveBeenCalledWith(
                expect.objectContaining({ production: true })
              );
              resolve();
            } catch (e) {
              reject(e);
            } finally {
              process.env.NODE_ENV = prevNodeEnv;
            }
          })
          .catch((err: Error) => {
            process.env.NODE_ENV = prevNodeEnv;
            reject(err);
          });
      });
    });
  });
});
