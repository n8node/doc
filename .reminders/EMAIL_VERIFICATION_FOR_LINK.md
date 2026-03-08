# REMINDER: Email Verification for Account Linking

When a user with a Telegram-only account links their email via Settings → Привязка аккаунтов → Привязать email, the email should be **verified** before it becomes active.

## Current State
- `POST /api/v1/user/link-email` saves email and password immediately
- No verification step

## TODO: Implement
1. On "Link email" submit: save pending email to a temporary table (e.g. `pending_email_verification`) with a token
2. Send verification email with link: `/auth/verify-email?token=xxx`
3. Create verification page that accepts token, updates user email, clears pending record
4. Only then allow email+password login
