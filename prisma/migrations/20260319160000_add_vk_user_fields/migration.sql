-- VK OAuth (ВКонтакте): привязка и вход
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vk_user_id" BIGINT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "vk_screen_name" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "users_vk_user_id_key" ON "users" ("vk_user_id") WHERE "vk_user_id" IS NOT NULL;
