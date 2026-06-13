import { sql, eq } from 'drizzle-orm';
import { toZonedTime } from 'date-fns-tz';
import { db } from '../db';
import { users } from '../db/schema';
import { sendPush } from './push';
import { pickMessage } from './reminderMessages';

const REMINDER_HOURS: ReadonlySet<number> = new Set([9, 11, 13, 15, 17, 19, 21]);
const MIN_GAP_MS = 90 * 60 * 1000;

export async function runReminderCron(now: Date = new Date()): Promise<void> {
  const candidates = await db.select().from(users);
  for (const u of candidates) {
    if (!u.remindersEnabled) continue;
    if (!u.pushToken) continue;
    if (u.deletedAt) continue;
    let localHour: number;
    try {
      localHour = toZonedTime(now, u.timezone).getHours();
    } catch {
      continue;
    }
    if (!REMINDER_HOURS.has(localHour)) continue;
    if (u.lastReminderSentAt && now.getTime() - u.lastReminderSentAt.getTime() < MIN_GAP_MS) continue;

    const msg = pickMessage(u.language, u.lastReminderMessageIds ?? []);
    await sendPush([u.pushToken], msg.title, msg.body, { kind: 'capture-reminder', messageId: msg.id });
    await db.update(users)
      .set({
        lastReminderSentAt: now,
        lastReminderMessageIds: sql`(array_prepend(${msg.id}, ${users.lastReminderMessageIds}))[1:3]`,
      })
      .where(eq(users.id, u.id));
  }
}
