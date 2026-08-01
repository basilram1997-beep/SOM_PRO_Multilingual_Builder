-- Add schoolId as nullable first, backfill safely, then make it required again.
ALTER TABLE "DailyTeacherStatus" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "Substitution" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;
ALTER TABLE "TeacherAssignment" ADD COLUMN IF NOT EXISTS "schoolId" TEXT;

DO $$
DECLARE
  unresolved_count integer;
  school_count integer;
  fallback_school_id text;
BEGIN
  WITH resolved AS (
    SELECT
      dts."id" AS row_id,
      CASE
        WHEN dss."schoolId" IS NOT NULL AND t."schoolId" IS NOT NULL AND dss."schoolId" <> t."schoolId" THEN NULL
        ELSE COALESCE(dss."schoolId", t."schoolId")
      END AS resolved_school_id
    FROM "DailyTeacherStatus" dts
    LEFT JOIN "DailySchedule" dss ON dss."id" = dts."dailyScheduleId"
    LEFT JOIN "Teacher" t ON t."id" = dts."teacherId"
    WHERE dts."schoolId" IS NULL
  )
  UPDATE "DailyTeacherStatus" dts
  SET "schoolId" = resolved.resolved_school_id
  FROM resolved
  WHERE dts."id" = resolved.row_id
    AND resolved.resolved_school_id IS NOT NULL;

  SELECT COUNT(*) INTO unresolved_count FROM "DailyTeacherStatus" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    SELECT COUNT(*), (
      SELECT s."id"
      FROM "School" s
      ORDER BY s."createdAt" ASC, s."id" ASC
      LIMIT 1
    )
    INTO school_count, fallback_school_id
    FROM "School" s;

    IF school_count = 1 AND fallback_school_id IS NOT NULL THEN
      UPDATE "DailyTeacherStatus"
      SET "schoolId" = fallback_school_id
      WHERE "schoolId" IS NULL;
      RAISE NOTICE 'DailyTeacherStatus: used fallback schoolId % for % unresolved rows.', fallback_school_id, unresolved_count;
    ELSE
      RAISE EXCEPTION 'DailyTeacherStatus: could not determine schoolId for % rows. Related daily schedule / teacher data was missing or inconsistent, and % schools exist.', unresolved_count, school_count;
    END IF;
  END IF;

  SELECT COUNT(*) INTO unresolved_count FROM "DailyTeacherStatus" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'DailyTeacherStatus: % rows still have NULL schoolId after backfill. Migration stopped for safety.', unresolved_count;
  END IF;
END $$;

DO $$
DECLARE
  unresolved_count integer;
  school_count integer;
  fallback_school_id text;
BEGIN
  WITH resolved AS (
    SELECT
      s."id" AS row_id,
      CASE
        WHEN ds."schoolId" IS NOT NULL AND c."schoolId" IS NOT NULL AND ds."schoolId" <> c."schoolId" THEN NULL
        WHEN ds."schoolId" IS NOT NULL AND at."schoolId" IS NOT NULL AND ds."schoolId" <> at."schoolId" THEN NULL
        WHEN ds."schoolId" IS NOT NULL AND st."schoolId" IS NOT NULL AND ds."schoolId" <> st."schoolId" THEN NULL
        WHEN c."schoolId" IS NOT NULL AND at."schoolId" IS NOT NULL AND c."schoolId" <> at."schoolId" THEN NULL
        WHEN c."schoolId" IS NOT NULL AND st."schoolId" IS NOT NULL AND c."schoolId" <> st."schoolId" THEN NULL
        WHEN at."schoolId" IS NOT NULL AND st."schoolId" IS NOT NULL AND at."schoolId" <> st."schoolId" THEN NULL
        ELSE COALESCE(ds."schoolId", c."schoolId", at."schoolId", st."schoolId")
      END AS resolved_school_id
    FROM "Substitution" s
    LEFT JOIN "DailySchedule" ds ON ds."id" = s."dailyScheduleId"
    LEFT JOIN "SchoolClass" c ON c."id" = s."classId"
    LEFT JOIN "Teacher" at ON at."id" = s."absentTeacherId"
    LEFT JOIN "Teacher" st ON st."id" = s."substituteTeacherId"
    WHERE s."schoolId" IS NULL
  )
  UPDATE "Substitution" s
  SET "schoolId" = resolved.resolved_school_id
  FROM resolved
  WHERE s."id" = resolved.row_id
    AND resolved.resolved_school_id IS NOT NULL;

  SELECT COUNT(*) INTO unresolved_count FROM "Substitution" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    SELECT COUNT(*), (
      SELECT sch."id"
      FROM "School" sch
      ORDER BY sch."createdAt" ASC, sch."id" ASC
      LIMIT 1
    )
    INTO school_count, fallback_school_id
    FROM "School" sch;

    IF school_count = 1 AND fallback_school_id IS NOT NULL THEN
      UPDATE "Substitution"
      SET "schoolId" = fallback_school_id
      WHERE "schoolId" IS NULL;
      RAISE NOTICE 'Substitution: used fallback schoolId % for % unresolved rows.', fallback_school_id, unresolved_count;
    ELSE
      RAISE EXCEPTION 'Substitution: could not determine schoolId for % rows. Related daily schedule / class / teacher data was missing or inconsistent, and % schools exist.', unresolved_count, school_count;
    END IF;
  END IF;

  SELECT COUNT(*) INTO unresolved_count FROM "Substitution" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Substitution: % rows still have NULL schoolId after backfill. Migration stopped for safety.', unresolved_count;
  END IF;
END $$;

DO $$
DECLARE
  unresolved_count integer;
  school_count integer;
  fallback_school_id text;
BEGIN
  WITH resolved AS (
    SELECT
      ta."id" AS row_id,
      CASE
        WHEN t."schoolId" IS NOT NULL AND c."schoolId" IS NOT NULL AND t."schoolId" <> c."schoolId" THEN NULL
        WHEN t."schoolId" IS NOT NULL AND su."schoolId" IS NOT NULL AND t."schoolId" <> su."schoolId" THEN NULL
        WHEN c."schoolId" IS NOT NULL AND su."schoolId" IS NOT NULL AND c."schoolId" <> su."schoolId" THEN NULL
        ELSE COALESCE(t."schoolId", c."schoolId", su."schoolId")
      END AS resolved_school_id
    FROM "TeacherAssignment" ta
    LEFT JOIN "Teacher" t ON t."id" = ta."teacherId"
    LEFT JOIN "SchoolClass" c ON c."id" = ta."classId"
    LEFT JOIN "Subject" su ON su."id" = ta."subjectId"
    WHERE ta."schoolId" IS NULL
  )
  UPDATE "TeacherAssignment" ta
  SET "schoolId" = resolved.resolved_school_id
  FROM resolved
  WHERE ta."id" = resolved.row_id
    AND resolved.resolved_school_id IS NOT NULL;

  SELECT COUNT(*) INTO unresolved_count FROM "TeacherAssignment" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    SELECT COUNT(*), (
      SELECT sch."id"
      FROM "School" sch
      ORDER BY sch."createdAt" ASC, sch."id" ASC
      LIMIT 1
    )
    INTO school_count, fallback_school_id
    FROM "School" sch;

    IF school_count = 1 AND fallback_school_id IS NOT NULL THEN
      UPDATE "TeacherAssignment"
      SET "schoolId" = fallback_school_id
      WHERE "schoolId" IS NULL;
      RAISE NOTICE 'TeacherAssignment: used fallback schoolId % for % unresolved rows.', fallback_school_id, unresolved_count;
    ELSE
      RAISE EXCEPTION 'TeacherAssignment: could not determine schoolId for % rows. Related teacher / class / subject data was missing or inconsistent, and % schools exist.', unresolved_count, school_count;
    END IF;
  END IF;

  SELECT COUNT(*) INTO unresolved_count FROM "TeacherAssignment" WHERE "schoolId" IS NULL;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'TeacherAssignment: % rows still have NULL schoolId after backfill. Migration stopped for safety.', unresolved_count;
  END IF;
END $$;

ALTER TABLE "DailyTeacherStatus" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "Substitution" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "TeacherAssignment" ALTER COLUMN "schoolId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'DailyTeacherStatus_schoolId_fkey'
  ) THEN
    ALTER TABLE "DailyTeacherStatus"
      ADD CONSTRAINT "DailyTeacherStatus_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Substitution_schoolId_fkey'
  ) THEN
    ALTER TABLE "Substitution"
      ADD CONSTRAINT "Substitution_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TeacherAssignment_schoolId_fkey'
  ) THEN
    ALTER TABLE "TeacherAssignment"
      ADD CONSTRAINT "TeacherAssignment_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DailyTeacherStatus_schoolId_idx" ON "DailyTeacherStatus" ("schoolId");
CREATE INDEX IF NOT EXISTS "Substitution_schoolId_idx" ON "Substitution" ("schoolId");
CREATE INDEX IF NOT EXISTS "TeacherAssignment_schoolId_idx" ON "TeacherAssignment" ("schoolId");
