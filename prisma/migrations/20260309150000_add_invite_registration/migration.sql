-- Invite-based registration support
CREATE TYPE "InviteScope" AS ENUM ('SYSTEM', 'USER');
CREATE TYPE "InviteStatus" AS ENUM ('ACTIVE', 'USED', 'REVOKED', 'EXPIRED');

CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "scope" "InviteScope" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "owner_user_id" TEXT,
    "created_by_user_id" TEXT,
    "used_by_user_id" TEXT,
    "used_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users" ADD COLUMN "registered_via_invite_id" TEXT;

CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");
CREATE INDEX "invites_scope_status_created_at_idx" ON "invites"("scope", "status", "created_at");
CREATE INDEX "invites_owner_user_id_status_created_at_idx" ON "invites"("owner_user_id", "status", "created_at");
CREATE INDEX "users_registered_via_invite_id_idx" ON "users"("registered_via_invite_id");

ALTER TABLE "invites"
    ADD CONSTRAINT "invites_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites"
    ADD CONSTRAINT "invites_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invites"
    ADD CONSTRAINT "invites_used_by_user_id_fkey"
    FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users"
    ADD CONSTRAINT "users_registered_via_invite_id_fkey"
    FOREIGN KEY ("registered_via_invite_id") REFERENCES "invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
