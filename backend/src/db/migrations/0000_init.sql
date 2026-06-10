CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE "public"."member_role" AS ENUM('admin', 'member');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "apple_sub" varchar,
  "google_sub" varchar,
  "email" varchar,
  "display_name" varchar NOT NULL,
  "avatar_url" text,
  "push_token" text,
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "users_apple_sub_unique" UNIQUE("apple_sub"),
  CONSTRAINT "users_google_sub_unique" UNIQUE("google_sub")
);
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL;

-- cover_photo_id FK added after photos table to avoid circular dependency
CREATE TABLE "albums" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "name" varchar NOT NULL,
  "child_birthdate" date,
  "cover_photo_id" uuid,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now(),
  "is_private" boolean DEFAULT false NOT NULL,
  "archived_at" timestamp with time zone
);
CREATE UNIQUE INDEX "albums_created_by_private_uniq" ON "albums" ("created_by") WHERE "is_private" = true;

CREATE TABLE "album_members" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "role" "member_role" DEFAULT 'member' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX "album_members_album_user_uniq" ON "album_members" ("album_id", "user_id");

CREATE TABLE "photos" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "uploaded_by" uuid NOT NULL REFERENCES "users"("id"),
  "r2_key" text NOT NULL,
  "thumbnail_key" text,
  "taken_at" timestamp with time zone NOT NULL,
  "caption" text,
  "local_asset_id" varchar,
  "created_at" timestamp with time zone DEFAULT now(),
  "media_type" varchar(8) DEFAULT 'photo' NOT NULL,
  "source" varchar(8) DEFAULT 'upload' NOT NULL,
  "duration_ms" integer,
  "width" integer,
  "height" integer
);
CREATE INDEX "idx_photos_album_taken_at" ON "photos" ("album_id", "taken_at" DESC NULLS LAST);
CREATE INDEX "idx_photos_local_asset" ON "photos" ("album_id", "local_asset_id") WHERE "photos"."local_asset_id" IS NOT NULL;
CREATE INDEX "idx_photos_capture_rate_limit" ON "photos" ("uploaded_by", "created_at" DESC NULLS LAST) WHERE "photos"."source" = 'capture';

ALTER TABLE "albums" ADD CONSTRAINT "albums_cover_photo_id_fkey"
  FOREIGN KEY ("cover_photo_id") REFERENCES "photos"("id") ON DELETE SET NULL;

CREATE TABLE "reactions" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "emoji" varchar(8) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);
CREATE UNIQUE INDEX "reactions_photo_user_uniq" ON "reactions" ("photo_id", "user_id");
CREATE INDEX "idx_reactions_photo" ON "reactions" ("photo_id");

CREATE TABLE "presign_tokens" (
  "key" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE "invites" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "token" varchar NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "users"("id"),
  "expires_at" timestamp with time zone,
  "max_uses" integer,
  "use_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "invites_token_unique" UNIQUE("token")
);

CREATE TABLE "day_labels" (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "label" text NOT NULL,
  "updated_by" uuid NOT NULL REFERENCES "users"("id"),
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "day_labels_album_date_uniq" ON "day_labels" ("album_id", "date");

CREATE TABLE "album_photos" (
  "photo_id" uuid NOT NULL REFERENCES "photos"("id") ON DELETE CASCADE,
  "album_id" uuid NOT NULL REFERENCES "albums"("id") ON DELETE CASCADE,
  "added_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("photo_id", "album_id")
);
CREATE INDEX "idx_album_photos_album_id" ON "album_photos" ("album_id", "added_at" DESC);

CREATE TABLE "waitlist" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
