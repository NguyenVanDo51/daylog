ALTER TABLE "albums" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
INSERT INTO albums (id, name, created_by, is_private, created_at)
SELECT uuid_generate_v4(), 'Ảnh của tôi', u.id, true, now()
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM albums a WHERE a.created_by = u.id AND a.is_private = true
);
--> statement-breakpoint
INSERT INTO album_members (id, album_id, user_id, role, joined_at)
SELECT uuid_generate_v4(), a.id, a.created_by, 'admin', now()
FROM albums a
WHERE a.is_private = true
  AND NOT EXISTS (
    SELECT 1 FROM album_members m WHERE m.album_id = a.id AND m.user_id = a.created_by
  );
