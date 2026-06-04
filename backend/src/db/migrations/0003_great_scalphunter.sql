ALTER TABLE "photos" ADD COLUMN "media_type" varchar(8) DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "source" varchar(8) DEFAULT 'upload' NOT NULL;--> statement-breakpoint
ALTER TABLE "photos" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
CREATE INDEX "idx_photos_capture_rate_limit" ON "photos" USING btree ("uploaded_by","created_at" DESC NULLS LAST) WHERE "photos"."source" = 'capture';