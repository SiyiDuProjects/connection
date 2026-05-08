DELETE FROM "user_settings" older
USING "user_settings" newer
WHERE older."user_id" = newer."user_id"
  AND older."id" < newer."id";

CREATE UNIQUE INDEX IF NOT EXISTS "user_settings_user_id_unique"
  ON "user_settings" ("user_id");
