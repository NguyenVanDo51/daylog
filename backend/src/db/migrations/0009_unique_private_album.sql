CREATE UNIQUE INDEX "albums_created_by_private_uniq" ON "albums" ("created_by") WHERE "is_private" = true;
