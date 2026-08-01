-- Add required admin MFA flags to match the current Prisma schema without resetting existing data.
ALTER TABLE "School"
ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SchoolSettings"
ADD COLUMN IF NOT EXISTS "admin_mfa_required" BOOLEAN NOT NULL DEFAULT false;
