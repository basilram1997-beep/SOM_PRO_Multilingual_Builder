ALTER TABLE "LicenseActivation"
ADD COLUMN "licenseCodeHash" TEXT;

UPDATE "LicenseActivation"
SET "licenseCodeHash" = NULLIF("metadata"->>'licenseCodeHash', '')
WHERE "metadata" IS NOT NULL
  AND NULLIF("metadata"->>'licenseCodeHash', '') IS NOT NULL;

CREATE UNIQUE INDEX "LicenseActivation_licenseCodeHash_key"
ON "LicenseActivation"("licenseCodeHash")
WHERE "licenseCodeHash" IS NOT NULL;

CREATE TABLE "LicenseResetToken" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip" TEXT,

  CONSTRAINT "LicenseResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LicenseResetToken_tokenHash_key" ON "LicenseResetToken"("tokenHash");
CREATE INDEX "LicenseResetToken_licenseId_idx" ON "LicenseResetToken"("licenseId");
CREATE INDEX "LicenseResetToken_expiresAt_idx" ON "LicenseResetToken"("expiresAt");

ALTER TABLE "LicenseResetToken"
ADD CONSTRAINT "LicenseResetToken_licenseId_fkey"
FOREIGN KEY ("licenseId") REFERENCES "LicenseActivation"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
