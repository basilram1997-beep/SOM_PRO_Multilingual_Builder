-- AlterTable
ALTER TABLE "Student" ADD COLUMN "first_name" TEXT,
ADD COLUMN "last_name" TEXT,
ADD COLUMN "internal_student_number" TEXT,
ADD COLUMN "external_id" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN "user_id" TEXT,
ADD COLUMN "employee_number" TEXT,
ADD COLUMN "external_id" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "SchoolClass" ADD COLUMN "grade_level" TEXT,
ADD COLUMN "homeroom_teacher_id" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN "code" TEXT,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "entity_type" TEXT,
ADD COLUMN "old_value" JSONB,
ADD COLUMN "new_value" JSONB,
ADD COLUMN "access_result" TEXT,
ADD COLUMN "ip_address" TEXT,
ADD COLUMN "user_agent" TEXT;

-- CreateTable
CREATE TABLE "teacher_subjects" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "lesson_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room_id" TEXT,
    "timetable_slot_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "recorded_by" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grades" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "grade_value" DOUBLE PRECISION,
    "grade_type" TEXT NOT NULL,
    "note" TEXT,
    "graded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classroom_logs" (
    "id" TEXT NOT NULL,
    "school_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "teacher_id" TEXT NOT NULL,
    "topic" TEXT,
    "log_text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classroom_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_user_id_key" ON "Teacher"("user_id");

-- CreateIndex
CREATE INDEX "Student_schoolId_internal_student_number_idx" ON "Student"("schoolId", "internal_student_number");

-- CreateIndex
CREATE INDEX "Student_schoolId_external_id_idx" ON "Student"("schoolId", "external_id");

-- CreateIndex
CREATE INDEX "Student_schoolId_status_idx" ON "Student"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_employee_number_idx" ON "Teacher"("schoolId", "employee_number");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_external_id_idx" ON "Teacher"("schoolId", "external_id");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_status_idx" ON "Teacher"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_homeroom_teacher_id_idx" ON "SchoolClass"("schoolId", "homeroom_teacher_id");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_status_idx" ON "SchoolClass"("schoolId", "status");

-- CreateIndex
CREATE INDEX "Subject_schoolId_code_idx" ON "Subject"("schoolId", "code");

-- CreateIndex
CREATE INDEX "Subject_schoolId_status_idx" ON "Subject"("schoolId", "status");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_entity_type_idx" ON "AuditLog"("schoolId", "entity_type");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_access_result_idx" ON "AuditLog"("schoolId", "access_result");

-- CreateIndex
CREATE INDEX "teacher_subjects_school_id_teacher_id_idx" ON "teacher_subjects"("school_id", "teacher_id");

-- CreateIndex
CREATE INDEX "teacher_subjects_school_id_subject_id_idx" ON "teacher_subjects"("school_id", "subject_id");

-- CreateIndex
CREATE INDEX "teacher_subjects_school_id_class_id_idx" ON "teacher_subjects"("school_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_subjects_school_id_teacher_id_subject_id_class_id_key" ON "teacher_subjects"("school_id", "teacher_id", "subject_id", "class_id");

-- CreateIndex
CREATE INDEX "lessons_school_id_lesson_date_idx" ON "lessons"("school_id", "lesson_date");

-- CreateIndex
CREATE INDEX "lessons_school_id_class_id_idx" ON "lessons"("school_id", "class_id");

-- CreateIndex
CREATE INDEX "lessons_school_id_subject_id_idx" ON "lessons"("school_id", "subject_id");

-- CreateIndex
CREATE INDEX "lessons_school_id_teacher_id_idx" ON "lessons"("school_id", "teacher_id");

-- CreateIndex
CREATE INDEX "lessons_school_id_timetable_slot_id_idx" ON "lessons"("school_id", "timetable_slot_id");

-- CreateIndex
CREATE INDEX "attendance_school_id_lesson_id_idx" ON "attendance"("school_id", "lesson_id");

-- CreateIndex
CREATE INDEX "attendance_school_id_student_id_idx" ON "attendance"("school_id", "student_id");

-- CreateIndex
CREATE INDEX "attendance_school_id_status_idx" ON "attendance"("school_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_school_id_lesson_id_student_id_key" ON "attendance"("school_id", "lesson_id", "student_id");

-- CreateIndex
CREATE INDEX "grades_school_id_student_id_idx" ON "grades"("school_id", "student_id");

-- CreateIndex
CREATE INDEX "grades_school_id_class_id_idx" ON "grades"("school_id", "class_id");

-- CreateIndex
CREATE INDEX "grades_school_id_subject_id_idx" ON "grades"("school_id", "subject_id");

-- CreateIndex
CREATE INDEX "grades_school_id_teacher_id_idx" ON "grades"("school_id", "teacher_id");

-- CreateIndex
CREATE INDEX "grades_school_id_graded_at_idx" ON "grades"("school_id", "graded_at");

-- CreateIndex
CREATE INDEX "classroom_logs_school_id_lesson_id_idx" ON "classroom_logs"("school_id", "lesson_id");

-- CreateIndex
CREATE INDEX "classroom_logs_school_id_class_id_idx" ON "classroom_logs"("school_id", "class_id");

-- CreateIndex
CREATE INDEX "classroom_logs_school_id_subject_id_idx" ON "classroom_logs"("school_id", "subject_id");

-- CreateIndex
CREATE INDEX "classroom_logs_school_id_teacher_id_idx" ON "classroom_logs"("school_id", "teacher_id");

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_homeroom_teacher_id_fkey" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_logs" ADD CONSTRAINT "classroom_logs_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_logs" ADD CONSTRAINT "classroom_logs_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_logs" ADD CONSTRAINT "classroom_logs_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_logs" ADD CONSTRAINT "classroom_logs_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classroom_logs" ADD CONSTRAINT "classroom_logs_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
