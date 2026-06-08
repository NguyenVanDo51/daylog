CREATE TABLE "day_labels" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "label" text NOT NULL,
  "updated_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX "day_labels_album_date_uniq" ON "day_labels" ("album_id", "date");
