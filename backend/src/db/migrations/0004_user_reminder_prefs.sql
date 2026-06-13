ALTER TABLE users
  ADD COLUMN timezone                  TEXT      NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN language                  TEXT      NOT NULL DEFAULT 'vi',
  ADD COLUMN reminders_enabled         BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN last_reminder_sent_at     TIMESTAMPTZ,
  ADD COLUMN last_reminder_message_ids INTEGER[] NOT NULL DEFAULT '{}';
