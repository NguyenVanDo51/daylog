CREATE TABLE "soundtracks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"key" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"artist" varchar(128),
	"duration_ms" integer NOT NULL,
	"file_path" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "soundtracks_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "day_soundtracks" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"album_id" uuid NOT NULL,
	"date" date NOT NULL,
	"soundtrack_id" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "day_soundtracks" ADD CONSTRAINT "day_soundtracks_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "public"."albums"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "day_soundtracks" ADD CONSTRAINT "day_soundtracks_soundtrack_id_soundtracks_id_fk" FOREIGN KEY ("soundtrack_id") REFERENCES "public"."soundtracks"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "day_soundtracks" ADD CONSTRAINT "day_soundtracks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "day_soundtracks_album_date_uniq" ON "day_soundtracks" USING btree ("album_id","date");
--> statement-breakpoint
INSERT INTO "soundtracks" ("key", "title", "artist", "duration_ms", "file_path", "sort_order", "is_active")
VALUES ('lullaby_01', 'Mây trắng (placeholder)', NULL, 30000, 'lullaby_01.mp3', 0, true);
