-- Add PASSWORD_RESET to EmailVerificationPurpose for password recovery flow
ALTER TYPE "EmailVerificationPurpose" ADD VALUE 'PASSWORD_RESET';
