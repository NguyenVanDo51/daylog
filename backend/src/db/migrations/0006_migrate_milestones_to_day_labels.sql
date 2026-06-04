-- Migrate milestones to day_labels. Each milestone becomes a label on the
-- date its `occurred_at` falls on (UTC). Note + cover_photo_id are dropped.
-- If multiple milestones exist for the same (album, date), keep the latest.
INSERT INTO day_labels (album_id, date, label, updated_by, updated_at)
SELECT
  album_id,
  DATE(occurred_at AT TIME ZONE 'UTC') AS date,
  title,
  created_by,
  COALESCE(created_at, now())
FROM milestones m1
WHERE created_at = (
  SELECT MAX(created_at)
  FROM milestones m2
  WHERE m2.album_id = m1.album_id
    AND DATE(m2.occurred_at AT TIME ZONE 'UTC') = DATE(m1.occurred_at AT TIME ZONE 'UTC')
)
ON CONFLICT (album_id, date) DO NOTHING;
