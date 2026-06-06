CREATE TABLE "album_photos" (
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("photo_id", "album_id")
);

CREATE INDEX "idx_album_photos_album_id" ON "album_photos" ("album_id", "added_at" DESC);
