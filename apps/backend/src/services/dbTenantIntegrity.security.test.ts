import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

type PrismaModel = {
  name: string;
  body: string;
};

const schemaPath = path.join("prisma", "schema.prisma");
const guardrailMigrationPath = path.join(
  "prisma",
  "migrations",
  "20260812143000_audit_append_only_and_lifecycle_evidence_guards",
  "migration.sql"
);

function parseModels(schemaSource: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const modelPattern = /^model\s+(\w+)\s+\{/gm;
  let match: RegExpExecArray | null;

  while ((match = modelPattern.exec(schemaSource))) {
    const name = match[1];
    const bodyStart = modelPattern.lastIndex;
    const bodyEnd = schemaSource.indexOf("\n}", bodyStart);
    assert.notEqual(bodyEnd, -1, `model ${name} should have a closing brace`);
    models.push({ name, body: schemaSource.slice(bodyStart, bodyEnd) });
  }

  return models;
}

function hasSchoolIndex(model: PrismaModel) {
  return /@@(?:index|unique)\(\[schoolId(?:,|\])/.test(model.body) || /schoolId\s+\w+\s+@unique\b/.test(model.body);
}

test("database migrations make audit append-only and preserve lifecycle evidence rows", () => {
  const migrationSource = readFileSync(guardrailMigrationPath, "utf8");
  const schemaSource = readFileSync(schemaPath, "utf8");
  const archiveRoutesSource = readFileSync(path.join("src", "modules", "archive", "archive.routes.ts"), "utf8");
  const schoolRoutesSource = readFileSync(path.join("src", "modules", "schools", "schools.routes.ts"), "utf8");

  assert.match(migrationSource, /CREATE OR REPLACE FUNCTION prevent_audit_log_mutation\(\)/);
  assert.match(migrationSource, /CREATE TRIGGER "AuditLog_prevent_update"[\s\S]*BEFORE UPDATE ON "AuditLog"/);
  assert.match(migrationSource, /CREATE TRIGGER "AuditLog_prevent_delete"[\s\S]*BEFORE DELETE ON "AuditLog"/);
  assert.match(migrationSource, /RAISE EXCEPTION 'AuditLog is append-only; update\/delete is not allowed'/);

  assert.match(
    migrationSource,
    /ALTER TABLE "reports_exports" DROP CONSTRAINT IF EXISTS "reports_exports_school_id_fkey"/
  );
  assert.match(
    migrationSource,
    /FOREIGN KEY \("school_id"\) REFERENCES "School"\("id"\)\s+ON DELETE RESTRICT ON UPDATE CASCADE/
  );
  assert.match(migrationSource, /ALTER TABLE "backup_jobs" DROP CONSTRAINT IF EXISTS "backup_jobs_school_id_fkey"/);
  assert.match(
    schemaSource,
    /ReportExport[\s\S]*School @relation\(fields: \[schoolId\], references: \[id\], onDelete: Restrict\)/
  );
  assert.match(
    schemaSource,
    /BackupJob[\s\S]*School @relation\(fields: \[schoolId\], references: \[id\], onDelete: Restrict\)/
  );

  assert.doesNotMatch(archiveRoutesSource, /auditLog\.deleteMany/);
  assert.doesNotMatch(schoolRoutesSource, /prisma\.auditLog\.deleteMany/);
  assert.doesNotMatch(schoolRoutesSource, /prisma\.reportExport\.deleteMany/);
  assert.doesNotMatch(schoolRoutesSource, /prisma\.backupJob\.deleteMany/);
  assert.match(schoolRoutesSource, /status:\s*"DELETED"/);
});

test("school-private Prisma models carry tenant ownership and a schoolId index or unique guard", () => {
  const schemaSource = readFileSync(schemaPath, "utf8");
  const models = parseModels(schemaSource);
  const byName = new Map(models.map((model) => [model.name, model]));
  const schoolScopedModels = models.filter((model) => /^\s+schoolId\s+String(?:\s|$)/m.test(model.body));
  const schoolScopedNames = schoolScopedModels.map((model) => model.name).sort();

  assert.deepEqual(schoolScopedNames, [
    "AttendanceRecord",
    "BackupJob",
    "BaseScheduleSlot",
    "ClassroomLog",
    "DailyEvent",
    "DailySchedule",
    "DailyTeacherStatus",
    "DutyAssignment",
    "GradeRecord",
    "HomeroomAssignment",
    "Lesson",
    "LicenseActivation",
    "ParentStudentLink",
    "PeriodDefinition",
    "ReportExport",
    "Role",
    "SchoolClass",
    "SchoolSettings",
    "SecurityIncident",
    "Student",
    "StudentAcademicRecord",
    "StudentAttendance",
    "StudentBehaviorRecord",
    "StudentCertificate",
    "StudentGradeEntry",
    "StudentGradeScheme",
    "StudentNotification",
    "Subject",
    "Substitution",
    "Teacher",
    "TeacherAssignment",
    "TeacherExam",
    "TeacherHomework",
    "TeacherHomeworkSubmission",
    "TeacherLessonToday",
    "TeacherSubject",
    "User",
    "UserRoleAssignment"
  ]);

  for (const model of schoolScopedModels) {
    assert.equal(hasSchoolIndex(model), true, `${model.name} must have @@index/@@unique beginning with schoolId`);
    assert.match(
      model.body,
      /school\s+School\s+@relation\(fields: \[schoolId\], references: \[id\]/,
      `${model.name} must relate schoolId to School`
    );
  }

  const auditLog = byName.get("AuditLog");
  assert.ok(auditLog);
  assert.match(auditLog.body, /schoolId\s+String\?/);
  assert.match(auditLog.body, /@@index\(\[schoolId, createdAt\]\)/);
  assert.match(auditLog.body, /@@index\(\[schoolId, action, createdAt\]\)/);
  assert.match(auditLog.body, /@@index\(\[schoolId, entityType, entityId\]\)/);

  const permittedGlobalModels = ["Permission", "RolePermission", "School"];
  for (const model of models.filter(
    (item) => !/^\s+schoolId\s+String(?:\s|$)/m.test(item.body) && item.name !== "AuditLog"
  )) {
    assert.equal(
      permittedGlobalModels.includes(model.name),
      true,
      `${model.name} must be explicitly global or school-scoped`
    );
  }
});
