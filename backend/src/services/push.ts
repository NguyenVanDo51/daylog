import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

const expo = new Expo();

export async function sendPush(
  pushTokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const validTokens = pushTokens.filter(t => Expo.isExpoPushToken(t));
  if (!validTokens.length) return;

  const messages: ExpoPushMessage[] = validTokens.map(to => ({ to, title, body, data }));
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        const invalidToken = (chunk[i] as ExpoPushMessage).to as string;
        await db.update(users).set({ pushToken: null }).where(eq(users.pushToken, invalidToken));
      }
    }
  }
}
