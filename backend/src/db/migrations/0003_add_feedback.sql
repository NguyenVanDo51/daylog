CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"message" text,
	"app_version" varchar(64),
	"platform" varchar(16),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_feedback_user_created" ON "feedback" USING btree ("user_id","created_at");
--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
