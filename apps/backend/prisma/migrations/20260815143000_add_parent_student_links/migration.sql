CREATE TABLE "parent_student_links" (
  "id" TEXT NOT NULL,
  "school_id" TEXT NOT NULL,
  "parent_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "verified_by" TEXT NOT NULL DEFAULT 'ADMIN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "parent_student_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "parent_student_links_school_id_parent_id_student_id_key"
  ON "parent_student_links" ("school_id", "parent_id", "student_id");

INSERT INTO "parent_student_links" ("id", "school_id", "parent_id", "student_id", "verified_by", "created_at", "updated_at")
SELECT
  'legacy-parent-link-' || u."id" || '-' || u."student_id",
  u."schoolId",
  u."id",
  u."student_id",
  'LEGACY_STUDENT_ID',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Student" s ON s."id" = u."student_id" AND s."schoolId" = u."schoolId"
WHERE u."role" = 'PARENT'
  AND u."student_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE INDEX "parent_student_links_school_id_parent_id_idx"
  ON "parent_student_links" ("school_id", "parent_id");

CREATE INDEX "parent_student_links_school_id_student_id_idx"
  ON "parent_student_links" ("school_id", "student_id");

ALTER TABLE "parent_student_links"
  ADD CONSTRAINT "parent_student_links_school_id_fkey"
  FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parent_student_links"
  ADD CONSTRAINT "parent_student_links_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "parent_student_links"
  ADD CONSTRAINT "parent_student_links_student_id_fkey"
  FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
