jest.mock('./push');

import { runReminderCron } from './reminderCron';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import * as pushModule from './push';

const mockSendPush = pushModule.sendPush as jest.MockedFunction<typeof pushModule.sendPush>;

async function makeUser(opts: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db.insert(users).values({
    displayName: 'Test',
    pushToken: 'ExponentPushToken[abc]',
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'vi',
    remindersEnabled: true,
    ...opts,
  }).returning();
  return u;
}

beforeEach(() => {
  mockSendPush.mockReset();
  mockSendPush.mockResolvedValue();
});

describe('runReminderCron', () => {
  it('sends to a user at a local reminder hour and updates state', async () => {
    const user = await makeUser();
    // 9:00 Asia/Ho_Chi_Minh (UTC+7) = 02:00 UTC
    const now = new Date('2026-06-13T02:00:00Z');
    await runReminderCron(now);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.lastReminderSentAt).toBeTruthy();
    expect(updated.lastReminderMessageIds).toHaveLength(1);
  });

  it('skips when reminders_enabled is false', async () => {
    await makeUser({ remindersEnabled: false });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when push_token is null', async () => {
    await makeUser({ pushToken: null });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when local hour is not a slot', async () => {
    await makeUser();
    // 10:00 VN = not a slot (slots: 9, 11, 13, 15, 17, 19, 21)
    await runReminderCron(new Date('2026-06-13T03:00:00Z'));
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('skips when last_reminder_sent_at < 90 min ago', async () => {
    const now = new Date('2026-06-13T02:00:00Z');
    const recent = new Date(now.getTime() - 30 * 60 * 1000);
    await makeUser({ lastReminderSentAt: recent });
    await runReminderCron(now);
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('sends when last_reminder_sent_at > 90 min ago and slot matches', async () => {
    const now = new Date('2026-06-13T02:00:00Z');
    const old = new Date(now.getTime() - 100 * 60 * 1000);
    await makeUser({ lastReminderSentAt: old });
    await runReminderCron(now);
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it('respects per-user timezone (LA user at 9am PDT)', async () => {
    await makeUser({ timezone: 'America/Los_Angeles' });
    // 9:00 PDT (UTC-7 in June) = 16:00 UTC
    await runReminderCron(new Date('2026-06-13T16:00:00Z'));
    expect(mockSendPush).toHaveBeenCalledTimes(1);
  });

  it('prepends new message id and keeps only last 3', async () => {
    const user = await makeUser({ lastReminderMessageIds: [3, 4, 5] });
    await runReminderCron(new Date('2026-06-13T02:00:00Z'));
    const [updated] = await db.select().from(users).where(eq(users.id, user.id));
    expect(updated.lastReminderMessageIds).toHaveLength(3);
    expect(updated.lastReminderMessageIds[1]).toBe(3);
    expect(updated.lastReminderMessageIds[2]).toBe(4);
  });
});
