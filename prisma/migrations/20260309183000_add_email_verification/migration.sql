-- Email verification for registration and linked email flow
CREATE TYPE "EmailVerificationPurpose" AS ENUM ('REGISTER', 'LINK_EMAIL');

ALTER TABLE "users"
    ADD COLUMN "is_email_verified" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "email_verified_at" TIMESTAMP(3);

CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "EmailVerificationPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "new_email" TEXT,
    "new_password_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");
CREATE INDEX "email_verification_tokens_user_id_purpose_created_at_idx" ON "email_verification_tokens"("user_id", "purpose", "created_at");
CREATE INDEX "email_verification_tokens_purpose_expires_at_idx" ON "email_verification_tokens"("purpose", "expires_at");
CREATE INDEX "email_verification_tokens_new_email_idx" ON "email_verification_tokens"("new_email");

ALTER TABLE "email_verification_tokens"
    ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
