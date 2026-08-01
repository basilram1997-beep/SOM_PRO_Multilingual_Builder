-- Add MFA columns that exist in the Prisma schema but may be missing from older databases.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "mfa_method" TEXT,
ADD COLUMN IF NOT EXISTS "mfa_secret_encrypted" TEXT;
