-- Data integrity hardening
-- Adds missing indexes and audit log foreign keys without touching existing data.

CREATE INDEX IF NOT EXISTS "Teacher_schoolId_employee_number_idx" ON "Teacher"("schoolId", "employee_number");
CREATE INDEX IF NOT EXISTS "Teacher_schoolId_external_id_idx" ON "Teacher"("schoolId", "external_id");
CREATE INDEX IF NOT EXISTS "SchoolClass_schoolId_homeroom_teacher_id_idx" ON "SchoolClass"("schoolId", "homeroom_teacher_id");
CREATE INDEX IF NOT EXISTS "Student_schoolId_internal_student_number_idx" ON "Student"("schoolId", "internal_student_number");
CREATE INDEX IF NOT EXISTS "Student_schoolId_nationalId_idx" ON "Student"("schoolId", "nationalId");
CREATE INDEX IF NOT EXISTS "Subject_schoolId_code_idx" ON "Subject"("schoolId", "code");
CREATE INDEX IF NOT EXISTS "TeacherAssignment_schoolId_teacherId_classId_idx" ON "TeacherAssignment"("schoolId", "teacherId", "classId");
CREATE INDEX IF NOT EXISTS "TeacherAssignment_schoolId_classId_subjectId_idx" ON "TeacherAssignment"("schoolId", "classId", "subjectId");
CREATE INDEX IF NOT EXISTS "DailyTeacherStatus_schoolId_dailyScheduleId_teacherId_idx" ON "DailyTeacherStatus"("schoolId", "dailyScheduleId", "teacherId");
CREATE INDEX IF NOT EXISTS "DailyTeacherStatus_schoolId_dailyScheduleId_type_idx" ON "DailyTeacherStatus"("schoolId", "dailyScheduleId", "type");
CREATE INDEX IF NOT EXISTS "Substitution_schoolId_dailyScheduleId_classId_period_idx" ON "Substitution"("schoolId", "dailyScheduleId", "classId", "period");
CREATE INDEX IF NOT EXISTS "Substitution_schoolId_absentTeacherId_period_idx" ON "Substitution"("schoolId", "absentTeacherId", "period");
CREATE INDEX IF NOT EXISTS "DailyEvent_schoolId_dailyScheduleId_type_idx" ON "DailyEvent"("schoolId", "dailyScheduleId", "type");
CREATE INDEX IF NOT EXISTS "DailyEvent_schoolId_dailyScheduleId_fromPeriod_idx" ON "DailyEvent"("schoolId", "dailyScheduleId", "fromPeriod");
CREATE INDEX IF NOT EXISTS "DutyAssignment_schoolId_schoolClassId_idx" ON "DutyAssignment"("schoolId", "schoolClassId");
CREATE INDEX IF NOT EXISTS "AuditLog_schoolId_action_createdAt_idx" ON "AuditLog"("schoolId", "action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_schoolId_entity_type_entityId_idx" ON "AuditLog"("schoolId", "entity_type", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "reports_exports_school_id_requested_by_created_at_idx" ON "reports_exports"("school_id", "requested_by", "created_at");
CREATE INDEX IF NOT EXISTS "backup_jobs_school_id_created_by_started_at_idx" ON "backup_jobs"("school_id", "created_by", "started_at");

DO $$
BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
