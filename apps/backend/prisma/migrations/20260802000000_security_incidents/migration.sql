DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecurityIncidentSeverity') THEN
    CREATE TYPE "SecurityIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecurityIncidentStatus') THEN
    CREATE TYPE "SecurityIncidentStatus" AS ENUM ('SUSPECTED', 'UNDER_REVIEW', 'CONTAINED', 'RESOLVED', 'CLOSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "security_incidents" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "severity" "SecurityIncidentSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "SecurityIncidentStatus" NOT NULL DEFAULT 'SUSPECTED',
  "detected_at" TIMESTAMP(3) NOT NULL,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notified_at" TIMESTAMP(3),
  "attack_vector" TEXT,
  "evidence_notes" TEXT,
  "systems_affected" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "data_affected" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vulnerabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "reported_by" TEXT,
  "reviewed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "security_incidents_school_id_reported_at_idx" ON "security_incidents"("school_id", "reported_at");
CREATE INDEX IF NOT EXISTS "security_incidents_school_id_status_idx" ON "security_incidents"("school_id", "status");
CREATE INDEX IF NOT EXISTS "security_incidents_school_id_severity_idx" ON "security_incidents"("school_id", "severity");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_incidents_school_id_fkey'
  ) THEN
    ALTER TABLE "security_incidents"
      ADD CONSTRAINT "security_incidents_school_id_fkey"
      FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_incidents_reported_by_fkey'
  ) THEN
    ALTER TABLE "security_incidents"
      ADD CONSTRAINT "security_incidents_reported_by_fkey"
      FOREIGN KEY ("reported_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'security_incidents_reviewed_by_fkey'
  ) THEN
    ALTER TABLE "security_incidents"
      ADD CONSTRAINT "security_incidents_reviewed_by_fkey"
      FOREIGN KEY ("reviewed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
