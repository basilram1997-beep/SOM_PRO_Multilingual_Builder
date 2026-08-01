-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SCHEDULER', 'TEACHER');

-- CreateEnum
CREATE TYPE "TeacherStatusType" AS ENUM ('ABSENT', 'LATE', 'LEFT', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SubstitutionKind" AS ENUM ('SAME_CLASS_AND_SUBJECT', 'SAME_CLASS', 'SAME_GRADE_AND_SUBJECT', 'SAME_SUBJECT', 'SAME_GRADE', 'FREE_ONLY', 'NO_SUBSTITUTE');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('TRIAL', 'ACTIVE', 'READ_ONLY', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StudentAttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT');

-- CreateEnum
CREATE TYPE "StudentAcademicTone" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "StudentBehaviorTone" AS ENUM ('POSITIVE', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "StudentCertificateType" AS ENUM ('TERM1_BIMONTHLY', 'TERM1_FINAL', 'TERM2_BIMONTHLY', 'TERM2_FINAL');

-- CreateEnum
CREATE TYPE "StudentCertificateResult" AS ENUM ('PASS', 'PASS_WITH_WARNING', 'REVIEW', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "StudentCertificateBehaviorLevel" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "TeacherLessonTodayStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "TeacherHomeworkKind" AS ENUM ('HOMEWORK', 'PREPARATION');

-- CreateEnum
CREATE TYPE "TeacherHomeworkSubmissionStatus" AS ENUM ('SOLVED', 'UNSOLVED', 'LATE');

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "managerName" TEXT,
    "institutionCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SCHEDULER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolSettings" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "workingDays" JSONB NOT NULL,
    "offDays" JSONB NOT NULL,
    "periodsPerDay" INTEGER NOT NULL DEFAULT 7,
    "maxTeachers" INTEGER NOT NULL DEFAULT 100,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeriodDefinition" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PeriodDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "specialty" TEXT,
    "adminRole" TEXT,
    "employmentRatio" INTEGER NOT NULL DEFAULT 100,
    "workDays" JSONB,
    "preferredDays" JSONB,
    "preferredClasses" JSONB,
    "preferredPeriods" JSONB,
    "releaseHours" INTEGER NOT NULL DEFAULT 0,
    "targetLoad" INTEGER NOT NULL DEFAULT 25,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolClass" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "section" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nationalId" TEXT,
    "fatherName" TEXT,
    "motherName" TEXT,
    "residence" TEXT,
    "fatherPhone" TEXT,
    "motherPhone" TEXT,
    "guardianPhone" TEXT,
    "healthFund" TEXT,
    "studentPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAttendance" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "status" "StudentAttendanceStatus" NOT NULL,
    "lateAt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentNotification" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT,
    "eventType" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'SMS',
    "recipientType" TEXT NOT NULL DEFAULT 'PARENT',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientPhones" JSONB NOT NULL,
    "recipientNames" JSONB,
    "payload" JSONB,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAcademicRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "tone" "StudentAcademicTone" NOT NULL DEFAULT 'POSITIVE',
    "strengths" TEXT,
    "weaknesses" TEXT,
    "assignments" TEXT,
    "lessonProgress" TEXT,
    "certificate" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAcademicRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentBehaviorRecord" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tone" "StudentBehaviorTone" NOT NULL DEFAULT 'POSITIVE',
    "template" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentBehaviorRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentCertificate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "certificateType" "StudentCertificateType" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "schoolNumber" TEXT,
    "presentDays" INTEGER NOT NULL DEFAULT 0,
    "absentDays" INTEGER NOT NULL DEFAULT 0,
    "lateDays" INTEGER NOT NULL DEFAULT 0,
    "behaviorLevel" "StudentCertificateBehaviorLevel" NOT NULL DEFAULT 'GOOD',
    "behaviorNote" TEXT,
    "teacherNotes" TEXT,
    "adminNotes" TEXT,
    "teacherSignature" TEXT,
    "principalSignature" TEXT,
    "average" DOUBLE PRECISION,
    "grade" TEXT,
    "result" "StudentCertificateResult" NOT NULL DEFAULT 'PASS',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "subjectRows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGradeScheme" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "certificateType" "StudentCertificateType" NOT NULL,
    "title" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 40,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGradeScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGradeEntry" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "certificateType" "StudentCertificateType" NOT NULL,
    "rows" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentGradeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherLessonToday" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" "TeacherLessonTodayStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "note" TEXT,
    "attachments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherLessonToday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHomework" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" "TeacherHomeworkKind" NOT NULL DEFAULT 'HOMEWORK',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TEXT,
    "attachment" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherHomework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherHomeworkSubmission" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "TeacherHomeworkSubmissionStatus" NOT NULL DEFAULT 'UNSOLVED',
    "note" TEXT,
    "grade" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherHomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherExam" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "notes" TEXT,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isHomeroom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "weeklyPeriods" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TeacherAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeroomAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "weeklyDay" TEXT,
    "weeklyPeriod" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeroomAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseScheduleSlot" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "BaseScheduleSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySchedule" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTeacherStatus" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dailyScheduleId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "TeacherStatusType" NOT NULL,
    "fromPeriod" INTEGER NOT NULL DEFAULT 1,
    "toPeriod" INTEGER NOT NULL,
    "reason" TEXT,

    CONSTRAINT "DailyTeacherStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Substitution" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dailyScheduleId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "baseSlotId" TEXT,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "absentTeacherId" TEXT NOT NULL,
    "substituteTeacherId" TEXT,
    "kind" "SubstitutionKind" NOT NULL,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "Substitution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyEvent" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "dailyScheduleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "classId" TEXT,
    "fromPeriod" INTEGER NOT NULL,
    "toPeriod" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "DailyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DutyAssignment" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "schoolClassId" TEXT,

    CONSTRAINT "DutyAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicenseActivation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "licenseKeyHash" TEXT NOT NULL,
    "schoolName" TEXT,
    "institutionCode" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'TRIAL',
    "status" "LicenseStatus" NOT NULL DEFAULT 'TRIAL',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "deviceFingerprint" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readOnlyReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicenseActivation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSettings_schoolId_key" ON "SchoolSettings"("schoolId");

-- CreateIndex
CREATE INDEX "PeriodDefinition_schoolId_isActive_idx" ON "PeriodDefinition"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PeriodDefinition_schoolId_period_key" ON "PeriodDefinition"("schoolId", "period");

-- CreateIndex
CREATE INDEX "Teacher_schoolId_idx" ON "Teacher"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_schoolId_name_key" ON "Teacher"("schoolId", "name");

-- CreateIndex
CREATE INDEX "SchoolClass_schoolId_idx" ON "SchoolClass"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolClass_schoolId_name_key" ON "SchoolClass"("schoolId", "name");

-- CreateIndex
CREATE INDEX "Student_schoolId_classId_idx" ON "Student"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "Student_schoolId_name_idx" ON "Student"("schoolId", "name");

-- CreateIndex
CREATE INDEX "StudentAttendance_schoolId_date_idx" ON "StudentAttendance"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StudentAttendance_studentId_date_idx" ON "StudentAttendance"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAttendance_schoolId_studentId_date_key" ON "StudentAttendance"("schoolId", "studentId", "date");

-- CreateIndex
CREATE INDEX "StudentNotification_schoolId_createdAt_idx" ON "StudentNotification"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentNotification_schoolId_studentId_createdAt_idx" ON "StudentNotification"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "StudentNotification_schoolId_status_idx" ON "StudentNotification"("schoolId", "status");

-- CreateIndex
CREATE INDEX "StudentAcademicRecord_schoolId_date_idx" ON "StudentAcademicRecord"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StudentAcademicRecord_schoolId_subjectId_idx" ON "StudentAcademicRecord"("schoolId", "subjectId");

-- CreateIndex
CREATE INDEX "StudentAcademicRecord_studentId_subjectId_idx" ON "StudentAcademicRecord"("studentId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAcademicRecord_schoolId_studentId_subjectId_date_key" ON "StudentAcademicRecord"("schoolId", "studentId", "subjectId", "date");

-- CreateIndex
CREATE INDEX "StudentBehaviorRecord_schoolId_date_idx" ON "StudentBehaviorRecord"("schoolId", "date");

-- CreateIndex
CREATE INDEX "StudentBehaviorRecord_schoolId_category_idx" ON "StudentBehaviorRecord"("schoolId", "category");

-- CreateIndex
CREATE INDEX "StudentBehaviorRecord_studentId_date_idx" ON "StudentBehaviorRecord"("studentId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBehaviorRecord_schoolId_studentId_date_category_tone_key" ON "StudentBehaviorRecord"("schoolId", "studentId", "date", "category", "tone");

-- CreateIndex
CREATE INDEX "StudentCertificate_schoolId_studentId_idx" ON "StudentCertificate"("schoolId", "studentId");

-- CreateIndex
CREATE INDEX "StudentCertificate_schoolId_issueDate_idx" ON "StudentCertificate"("schoolId", "issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "StudentCertificate_schoolId_studentId_certificateType_acade_key" ON "StudentCertificate"("schoolId", "studentId", "certificateType", "academicYear");

-- CreateIndex
CREATE INDEX "StudentGradeScheme_schoolId_classId_idx" ON "StudentGradeScheme"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "StudentGradeScheme_schoolId_subjectId_idx" ON "StudentGradeScheme"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGradeScheme_schoolId_classId_subjectId_certificateTy_key" ON "StudentGradeScheme"("schoolId", "classId", "subjectId", "certificateType");

-- CreateIndex
CREATE INDEX "StudentGradeEntry_schoolId_classId_idx" ON "StudentGradeEntry"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "StudentGradeEntry_schoolId_subjectId_idx" ON "StudentGradeEntry"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGradeEntry_schoolId_classId_subjectId_certificateTyp_key" ON "StudentGradeEntry"("schoolId", "classId", "subjectId", "certificateType");

-- CreateIndex
CREATE INDEX "TeacherLessonToday_schoolId_date_idx" ON "TeacherLessonToday"("schoolId", "date");

-- CreateIndex
CREATE INDEX "TeacherLessonToday_teacherId_date_idx" ON "TeacherLessonToday"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherLessonToday_classId_date_idx" ON "TeacherLessonToday"("classId", "date");

-- CreateIndex
CREATE INDEX "TeacherLessonToday_subjectId_date_idx" ON "TeacherLessonToday"("subjectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherLessonToday_schoolId_teacherId_date_period_classId_s_key" ON "TeacherLessonToday"("schoolId", "teacherId", "date", "period", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "TeacherHomework_schoolId_date_idx" ON "TeacherHomework"("schoolId", "date");

-- CreateIndex
CREATE INDEX "TeacherHomework_teacherId_date_idx" ON "TeacherHomework"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherHomework_classId_date_idx" ON "TeacherHomework"("classId", "date");

-- CreateIndex
CREATE INDEX "TeacherHomework_subjectId_date_idx" ON "TeacherHomework"("subjectId", "date");

-- CreateIndex
CREATE INDEX "TeacherHomeworkSubmission_homeworkId_idx" ON "TeacherHomeworkSubmission"("homeworkId");

-- CreateIndex
CREATE INDEX "TeacherHomeworkSubmission_studentId_idx" ON "TeacherHomeworkSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherHomeworkSubmission_schoolId_homeworkId_studentId_key" ON "TeacherHomeworkSubmission"("schoolId", "homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "TeacherExam_schoolId_date_idx" ON "TeacherExam"("schoolId", "date");

-- CreateIndex
CREATE INDEX "TeacherExam_teacherId_date_idx" ON "TeacherExam"("teacherId", "date");

-- CreateIndex
CREATE INDEX "TeacherExam_classId_date_idx" ON "TeacherExam"("classId", "date");

-- CreateIndex
CREATE INDEX "TeacherExam_subjectId_date_idx" ON "TeacherExam"("subjectId", "date");

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_teacherId_idx" ON "TeacherAssignment"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_classId_idx" ON "TeacherAssignment"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "TeacherAssignment_schoolId_subjectId_idx" ON "TeacherAssignment"("schoolId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAssignment_schoolId_teacherId_classId_subjectId_key" ON "TeacherAssignment"("schoolId", "teacherId", "classId", "subjectId");

-- CreateIndex
CREATE INDEX "HomeroomAssignment_schoolId_teacherId_idx" ON "HomeroomAssignment"("schoolId", "teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeroomAssignment_schoolId_classId_key" ON "HomeroomAssignment"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "BaseScheduleSlot_schoolId_day_period_idx" ON "BaseScheduleSlot"("schoolId", "day", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BaseScheduleSlot_schoolId_day_period_classId_key" ON "BaseScheduleSlot"("schoolId", "day", "period", "classId");

-- CreateIndex
CREATE INDEX "DailySchedule_schoolId_day_idx" ON "DailySchedule"("schoolId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "DailySchedule_schoolId_date_key" ON "DailySchedule"("schoolId", "date");

-- CreateIndex
CREATE INDEX "DailyTeacherStatus_schoolId_dailyScheduleId_idx" ON "DailyTeacherStatus"("schoolId", "dailyScheduleId");

-- CreateIndex
CREATE INDEX "DailyTeacherStatus_schoolId_teacherId_idx" ON "DailyTeacherStatus"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "Substitution_schoolId_dailyScheduleId_period_idx" ON "Substitution"("schoolId", "dailyScheduleId", "period");

-- CreateIndex
CREATE INDEX "Substitution_schoolId_substituteTeacherId_period_idx" ON "Substitution"("schoolId", "substituteTeacherId", "period");

-- CreateIndex
CREATE INDEX "DailyEvent_schoolId_dailyScheduleId_idx" ON "DailyEvent"("schoolId", "dailyScheduleId");

-- CreateIndex
CREATE INDEX "DailyEvent_schoolId_classId_idx" ON "DailyEvent"("schoolId", "classId");

-- CreateIndex
CREATE INDEX "DutyAssignment_schoolId_day_idx" ON "DutyAssignment"("schoolId", "day");

-- CreateIndex
CREATE INDEX "DutyAssignment_schoolId_teacherId_idx" ON "DutyAssignment"("schoolId", "teacherId");

-- CreateIndex
CREATE INDEX "AuditLog_schoolId_createdAt_idx" ON "AuditLog"("schoolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicenseActivation_licenseKeyHash_key" ON "LicenseActivation"("licenseKeyHash");

-- CreateIndex
CREATE INDEX "LicenseActivation_schoolId_status_idx" ON "LicenseActivation"("schoolId", "status");

-- CreateIndex
CREATE INDEX "LicenseActivation_deviceFingerprint_idx" ON "LicenseActivation"("deviceFingerprint");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolSettings" ADD CONSTRAINT "SchoolSettings_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeriodDefinition" ADD CONSTRAINT "PeriodDefinition_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolClass" ADD CONSTRAINT "SchoolClass_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAttendance" ADD CONSTRAINT "StudentAttendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNotification" ADD CONSTRAINT "StudentNotification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentNotification" ADD CONSTRAINT "StudentNotification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademicRecord" ADD CONSTRAINT "StudentAcademicRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademicRecord" ADD CONSTRAINT "StudentAcademicRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentAcademicRecord" ADD CONSTRAINT "StudentAcademicRecord_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBehaviorRecord" ADD CONSTRAINT "StudentBehaviorRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBehaviorRecord" ADD CONSTRAINT "StudentBehaviorRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCertificate" ADD CONSTRAINT "StudentCertificate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentCertificate" ADD CONSTRAINT "StudentCertificate_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeScheme" ADD CONSTRAINT "StudentGradeScheme_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeScheme" ADD CONSTRAINT "StudentGradeScheme_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeScheme" ADD CONSTRAINT "StudentGradeScheme_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeEntry" ADD CONSTRAINT "StudentGradeEntry_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeEntry" ADD CONSTRAINT "StudentGradeEntry_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGradeEntry" ADD CONSTRAINT "StudentGradeEntry_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonToday" ADD CONSTRAINT "TeacherLessonToday_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonToday" ADD CONSTRAINT "TeacherLessonToday_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonToday" ADD CONSTRAINT "TeacherLessonToday_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherLessonToday" ADD CONSTRAINT "TeacherLessonToday_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomework" ADD CONSTRAINT "TeacherHomework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomework" ADD CONSTRAINT "TeacherHomework_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomework" ADD CONSTRAINT "TeacherHomework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomework" ADD CONSTRAINT "TeacherHomework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomeworkSubmission" ADD CONSTRAINT "TeacherHomeworkSubmission_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomeworkSubmission" ADD CONSTRAINT "TeacherHomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "TeacherHomework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherHomeworkSubmission" ADD CONSTRAINT "TeacherHomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExam" ADD CONSTRAINT "TeacherExam_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExam" ADD CONSTRAINT "TeacherExam_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExam" ADD CONSTRAINT "TeacherExam_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherExam" ADD CONSTRAINT "TeacherExam_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherAssignment" ADD CONSTRAINT "TeacherAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeroomAssignment" ADD CONSTRAINT "HomeroomAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeroomAssignment" ADD CONSTRAINT "HomeroomAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeroomAssignment" ADD CONSTRAINT "HomeroomAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseScheduleSlot" ADD CONSTRAINT "BaseScheduleSlot_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseScheduleSlot" ADD CONSTRAINT "BaseScheduleSlot_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseScheduleSlot" ADD CONSTRAINT "BaseScheduleSlot_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaseScheduleSlot" ADD CONSTRAINT "BaseScheduleSlot_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySchedule" ADD CONSTRAINT "DailySchedule_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTeacherStatus" ADD CONSTRAINT "DailyTeacherStatus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTeacherStatus" ADD CONSTRAINT "DailyTeacherStatus_dailyScheduleId_fkey" FOREIGN KEY ("dailyScheduleId") REFERENCES "DailySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTeacherStatus" ADD CONSTRAINT "DailyTeacherStatus_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_dailyScheduleId_fkey" FOREIGN KEY ("dailyScheduleId") REFERENCES "DailySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_absentTeacherId_fkey" FOREIGN KEY ("absentTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Substitution" ADD CONSTRAINT "Substitution_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEvent" ADD CONSTRAINT "DailyEvent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyEvent" ADD CONSTRAINT "DailyEvent_dailyScheduleId_fkey" FOREIGN KEY ("dailyScheduleId") REFERENCES "DailySchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DutyAssignment" ADD CONSTRAINT "DutyAssignment_schoolClassId_fkey" FOREIGN KEY ("schoolClassId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LicenseActivation" ADD CONSTRAINT "LicenseActivation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

