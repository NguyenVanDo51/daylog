// Manual mock for expo-server-sdk — keeps Jest in CJS mode without ESM transform issues.
const mockSend = jest.fn().mockResolvedValue([{ status: 'ok', id: 'receipt-id' }]);
const mockChunk = jest.fn().mockImplementation((msgs) => [msgs]);
const MockExpo = jest.fn().mockImplementation(() => ({
  sendPushNotificationsAsync: mockSend,
  chunkPushNotifications: mockChunk,
}));
MockExpo.isExpoPushToken = jest.fn().mockReturnValue(true);

module.exports = {
  Expo: MockExpo,
  __mockSend: mockSend,
  __mockChunk: mockChunk,
  __mockIsValid: MockExpo.isExpoPushToken,
};
