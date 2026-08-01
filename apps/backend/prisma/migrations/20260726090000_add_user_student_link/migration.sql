-- Add nullable student link for portal accounts.
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "student_id" TEXT;

CREATE INDEX IF NOT EXISTS "User_schoolId_student_id_idx" ON "User"("schoolId", "student_id");

ALTER TABLE "User"
ADD CONSTRAINT "User_student_id_fkey"
FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
