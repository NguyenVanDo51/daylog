jest.mock('@/lib/api', () => ({
  api: { patch: jest.fn().mockResolvedValue({}) },
}));

import * as Notifications from 'expo-notifications';
import { api } from '@/lib/api';
import { registerPushToken, hasPushPermission } from '@/lib/notifications';

// Capture the module-load call to setNotificationHandler before any
// beforeEach clears it.
const setHandlerCallsAtLoad = (
  Notifications.setNotificationHandler as jest.Mock
).mock.calls.slice();

describe('notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('setNotificationHandler', () => {
    it('is called at module load with handler returning the correct shape', async () => {
      expect(setHandlerCallsAtLoad.length).toBeGreaterThanOrEqual(1);

      const callArg = setHandlerCallsAtLoad[0][0];
      expect(callArg).toBeDefined();
      expect(typeof callArg.handleNotification).toBe('function');

      const result = await callArg.handleNotification();
      expect(result).toEqual({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      });
    });
  });

  describe('registerPushToken', () => {
    it('returns false when permission is denied and does not call api.patch', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      const result = await registerPushToken();

      expect(result).toBe(false);
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('returns true when granted and posts the token to /users/me', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'tok-123',
      });

      const result = await registerPushToken();

      expect(result).toBe(true);
      expect(api.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.objectContaining({ push_token: 'tok-123' }),
      );
    });

    it('also sends timezone and language with the push token', async () => {
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });
      (Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
        data: 'tok-abc',
      });

      await registerPushToken();

      expect(api.patch).toHaveBeenCalledWith(
        '/users/me',
        expect.objectContaining({
          push_token: 'tok-abc',
          timezone: expect.any(String),
          language: expect.stringMatching(/^(vi|en)$/),
        }),
      );
    });
  });

  describe('hasPushPermission', () => {
    it('returns true when permission status is granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
      });

      await expect(hasPushPermission()).resolves.toBe(true);
    });

    it('returns false when permission status is not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
      });

      await expect(hasPushPermission()).resolves.toBe(false);
    });
  });
});
