ALTER TABLE "users" ADD COLUMN "email" varchar;
CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email") WHERE "email" IS NOT NULL;
