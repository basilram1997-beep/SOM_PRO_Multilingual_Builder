import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { StudentAttendanceSchema, StudentSchema } from "@som/shared";
import { prisma } from "../db/prisma";
import { buildStudentDuplicateWhere, buildStudentImportDuplicateWhere } from "./studentIdentity";
import { completeBackupJobRecord, createBackupJobRecord, createReportExportRecord } from "./artifactRecords";

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cleanupSchoolData(schoolId: string) {
  await prisma.gradeRecord.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.studentAttendance.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.studentGradeEntry.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.teacherSubject.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.student.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.teacher.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.subject.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.schoolClass.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.reportExport.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.backupJob.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.user.deleteMany({ where: { schoolId } }).catch(() => null);
  await prisma.school.deleteMany({ where: { id: schoolId } }).catch(() => null);
}

async function createSchoolFixture(runId: string, maxStudents = 1) {
  const schoolId = `db-school-${runId}`;
  const classId = `db-class-${runId}`;
  const subjectId = `db-subject-${runId}`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `DB School ${runId}`,
      address: "Test address",
      managerName: "Test Manager",
      institutionCode: `DB${runId.toUpperCase()}`,
      isActive: true
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: `1A-${runId}`,
      gradeLevel: "1",
      section: "A",
      maxStudents
    }
  });

  await prisma.subject.create({
    data: {
      id: subjectId,
      schoolId,
      name: `Mathematics ${runId}`
    }
  });

  return { schoolId, classId, subjectId };
}

test("database contracts keep the core integrity guardrails in place", () => {
  const schemaSource = readFileSync("prisma/schema.prisma", "utf8");
  const studentsRoutesSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const migrationSource = readFileSync(
    "prisma/migrations/20260718175000_baseline_current_schema/migration.sql",
    "utf8"
  );
  const hardeningMigrationSource = readFileSync(
    "prisma/migrations/20260719083000_data_integrity_hardening/migration.sql",
    "utf8"
  );
  const schemaRepairSource = readFileSync("src/services/schemaRepair.ts", "utf8");
  const artifactMigrationSource = readFileSync(
    "prisma/migrations/20260808190000_add_unique_report_export_and_backup_file_paths/migration.sql",
    "utf8"
  );
  const legacyAttendanceMigrationSource = readFileSync(
    "prisma/migrations/20260811121000_normalize_legacy_attendance_absent_status/migration.sql",
    "utf8"
  );
  const backupMigrationSource = readFileSync(
    "prisma/migrations/20260718193000_add_reports_exports_and_backup_jobs/migration.sql",
    "utf8"
  );

  assert.throws(() => StudentSchema.parse({ name: "طالب بدون صف" }), /classId/);

  for (const status of ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "LEFT_EARLY"] as const) {
    assert.doesNotThrow(() =>
      StudentAttendanceSchema.parse({
        studentId: "student-1",
        date: "2026-07-23",
        day: "الخميس",
        status
      })
    );
  }

  const duplicateWhere = buildStudentDuplicateWhere("school-a", "class-a", {
    name: "طالب أحمد",
    nationalId: "991234567",
    fatherName: "أحمد",
    motherName: "سلمى"
  });
  assert.equal(duplicateWhere.schoolId, "school-a");
  assert.equal(duplicateWhere.classId, "class-a");
  assert.equal(Array.isArray(duplicateWhere.OR), true);
  assert.equal(duplicateWhere.OR?.length, 2);
  assert.deepEqual(duplicateWhere.OR?.[0], { nationalId: "991234567" });

  const importDuplicateWhere = buildStudentImportDuplicateWhere("school-a", {
    name: "طالب أحمد",
    nationalId: "991234567"
  });
  assert.equal(importDuplicateWhere.schoolId, "school-a");
  assert.equal(Array.isArray(importDuplicateWhere.OR), true);
  assert.equal(importDuplicateWhere.OR?.length, 2);

  assert.match(schemaSource, /classId\s+String/);
  assert.match(schemaSource, /@@index\(\[schoolId, nationalId\]\)/);
  assert.match(schemaSource, /@@unique\(\[schoolId, studentId, date\]\)/);
  assert.match(schemaSource, /@@unique\(\[schoolId, teacherId, subjectId, classId\]\)/);
  assert.match(schemaSource, /@@unique\(\[schoolId, studentId, certificateType, academicYear\]\)/);
  assert.match(schemaSource, /maxStudents\s+Int\?\s+@map\("max_students"\)/);

  assert.match(
    studentsRoutesSource,
    /studentsRouter\.post\(\s*"\/import",\s*(?:requirePermissionForWrite|\(0, auth_1\.requirePermissionForWrite\))\("manageSettings"\),\s*(?:validateBody|\(0, validate_1\.validateBody\))\(StudentImportSchema\),\s*async \(req, res\) => \{/
  );
  assert.match(
    studentsRoutesSource,
    /const importedStudents = await prisma(?:_1\.prisma)?\.\$transaction\(async \(transaction\) => \{/
  );
  assert.match(studentsRoutesSource, /getClassCapacityState\(transaction, schoolId, classId\)/);
  assert.match(
    studentsRoutesSource,
    /buildStudentImportDuplicateWhere\(schoolId, payload\)|\(0, studentIdentity_1\.buildStudentImportDuplicateWhere\)\(schoolId, payload\)/
  );

  assert.match(migrationSource, /StudentAttendance_schoolId_studentId_date_key/);
  assert.match(migrationSource, /StudentGradeEntry_schoolId_classId_subjectId_certificateTyp_key/);
  assert.match(migrationSource, /TeacherAssignment_schoolId_teacherId_classId_subjectId_key/);

  assert.match(hardeningMigrationSource, /Teacher_schoolId_employee_number_idx/);
  assert.match(hardeningMigrationSource, /Teacher_schoolId_external_id_idx/);
  assert.match(hardeningMigrationSource, /SchoolClass_schoolId_homeroom_teacher_id_idx/);
  assert.match(hardeningMigrationSource, /Student_schoolId_internal_student_number_idx/);
  assert.match(hardeningMigrationSource, /AuditLog_schoolId_entity_type_entityId_idx/);
  assert.match(hardeningMigrationSource, /reports_exports_school_id_requested_by_created_at_idx/);
  assert.match(hardeningMigrationSource, /backup_jobs_school_id_created_by_started_at_idx/);
  assert.match(schemaRepairSource, /allowedRepairTables/);
  assert.match(schemaRepairSource, /assertAllowedRepairTarget/);
  assert.match(schemaRepairSource, /quotedIdentifier/);
  assert.doesNotMatch(schemaRepairSource, /\$executeRawUnsafe/);
  assert.doesNotMatch(schemaRepairSource, /\$queryRawUnsafe/);
  assert.match(artifactMigrationSource, /reports_exports_school_id_file_path_key/);
  assert.match(artifactMigrationSource, /backup_jobs_school_id_file_path_key/);
  assert.match(legacyAttendanceMigrationSource, /ABSENT_UNEXCUSED/);
  assert.doesNotMatch(legacyAttendanceMigrationSource, /ABSENT_EXCUSED/);
  assert.doesNotMatch(hardeningMigrationSource, /employeeNumber/);
  assert.match(backupMigrationSource, /CREATE TABLE "reports_exports"/);
  assert.match(backupMigrationSource, /CREATE TABLE "backup_jobs"/);
  assert.match(backupMigrationSource, /reports_exports_school_id_fkey/);
  assert.match(backupMigrationSource, /backup_jobs_school_id_fkey/);

  const migrationDirs = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.ok(migrationDirs.length >= 5);
  assert.ok(migrationDirs.includes("20260718175000_baseline_current_schema"));
  assert.ok(migrationDirs.includes("20260718193000_add_reports_exports_and_backup_jobs"));
  assert.ok(migrationDirs.includes("20260722103000_add_schoolclass_max_students"));
  assert.ok(migrationDirs.includes("20260808190000_add_unique_report_export_and_backup_file_paths"));
  assert.ok(migrationDirs.includes("20260811121000_normalize_legacy_attendance_absent_status"));
});

test("a failed batch write rolls back all inserted rows instead of leaving a partial set behind", async () => {
  const runId = makeRunId();
  const { schoolId, classId } = await createSchoolFixture(runId, 1);

  try {
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        for (let index = 1; index <= 30; index += 1) {
          await tx.student.create({
            data: {
              schoolId,
              classId,
              name: `طالب ${index} ${runId}`,
              nationalId: `${index}-${runId}`
            }
          });

          if (index === 20) {
            throw new Error("forced batch failure");
          }
        }
      }),
      /forced batch failure/
    );

    const remainingStudents = await prisma.student.count({ where: { schoolId } });
    assert.equal(remainingStudents, 0);
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("attendance stays unique for a student on the same day", async () => {
  const runId = makeRunId();
  const { schoolId, classId } = await createSchoolFixture(runId);
  const student = await prisma.student.create({
    data: {
      schoolId,
      classId,
      name: `طالب الحضور ${runId}`,
      nationalId: `ATT-${runId}`
    }
  });

  try {
    await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-23"
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        date: "2026-07-23",
        day: "الخميس",
        status: "PRESENT"
      },
      update: {
        day: "الخميس",
        status: "LATE",
        lateAt: "08:15"
      }
    });

    await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-23"
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        date: "2026-07-23",
        day: "الخميس",
        status: "PRESENT"
      },
      update: {
        day: "الخميس",
        status: "LATE",
        lateAt: "08:30"
      }
    });

    const records = await prisma.studentAttendance.findMany({
      where: { schoolId, studentId: student.id, date: "2026-07-23" }
    });

    assert.equal(records.length, 1);
    assert.equal(records[0]?.status, "LATE");
    assert.equal(records[0]?.lateAt, "08:30");
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("attendance CRUD keeps create, read, update, and delete behavior aligned", async () => {
  const runId = makeRunId();
  const { schoolId, classId } = await createSchoolFixture(runId);
  const student = await prisma.student.create({
    data: {
      schoolId,
      classId,
      name: `Attendance CRUD ${runId}`,
      nationalId: `CRUD-${runId}`
    }
  });

  try {
    const created = await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-24"
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        date: "2026-07-24",
        day: "الخميس",
        status: "ABSENT_EXCUSED",
        note: "medical leave"
      },
      update: {
        day: "الخميس",
        status: "ABSENT_EXCUSED",
        note: "medical leave"
      }
    });

    const readBack = await prisma.studentAttendance.findUnique({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-24"
        }
      }
    });

    assert.equal(created.status, "ABSENT_EXCUSED");
    assert.equal(readBack?.studentId, student.id);
    assert.equal(readBack?.status, "ABSENT_EXCUSED");
    assert.equal(readBack?.note, "medical leave");

    const updated = await prisma.studentAttendance.upsert({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-24"
        }
      },
      create: {
        schoolId,
        studentId: student.id,
        date: "2026-07-24",
        day: "الخميس",
        status: "PRESENT"
      },
      update: {
        day: "الخميس",
        status: "LATE",
        lateAt: "08:12",
        note: "late arrival"
      }
    });

    const reread = await prisma.studentAttendance.findUnique({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-24"
        }
      }
    });

    assert.equal(updated.status, "LATE");
    assert.equal(reread?.status, "LATE");
    assert.equal(reread?.lateAt, "08:12");
    assert.equal(reread?.note, "late arrival");

    const deleted = await prisma.studentAttendance.deleteMany({
      where: { schoolId, studentId: student.id, date: "2026-07-24" }
    });
    assert.equal(deleted.count, 1);
    const afterDelete = await prisma.studentAttendance.findUnique({
      where: {
        schoolId_studentId_date: {
          schoolId,
          studentId: student.id,
          date: "2026-07-24"
        }
      }
    });
    assert.equal(afterDelete, null);
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("teacher, subject, and class relations stay aligned and remain unique", async () => {
  const runId = makeRunId();
  const { schoolId, classId, subjectId } = await createSchoolFixture(runId);
  const teacher = await prisma.teacher.create({
    data: {
      schoolId,
      name: `معلم المادة ${runId}`,
      employeeNumber: `EMP-${runId}`
    }
  });

  try {
    const relation = await prisma.teacherSubject.create({
      data: {
        schoolId,
        teacherId: teacher.id,
        subjectId,
        classId
      }
    });

    assert.equal(relation.schoolId, schoolId);
    assert.equal(relation.teacherId, teacher.id);
    assert.equal(relation.subjectId, subjectId);
    assert.equal(relation.classId, classId);

    await assert.rejects(
      prisma.teacherSubject.create({
        data: {
          schoolId,
          teacherId: teacher.id,
          subjectId,
          classId
        }
      }),
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    );
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("grade records disappear when the owning student or subject is deleted", async () => {
  const runId = makeRunId();
  const { schoolId, classId, subjectId } = await createSchoolFixture(runId, 3);
  const teacher = await prisma.teacher.create({
    data: {
      schoolId,
      name: `معلم العلامات ${runId}`,
      employeeNumber: `GRD-${runId}`
    }
  });
  const student = await prisma.student.create({
    data: {
      schoolId,
      classId,
      name: `طالب العلامة ${runId}`,
      nationalId: `GR-${runId}`
    }
  });
  const anotherSubject = await prisma.subject.create({
    data: {
      schoolId,
      name: `Science ${runId}`
    }
  });
  const anotherStudent = await prisma.student.create({
    data: {
      schoolId,
      classId,
      name: `طالب المادة الثانية ${runId}`,
      nationalId: `GR2-${runId}`
    }
  });

  try {
    const firstGrade = await prisma.gradeRecord.create({
      data: {
        schoolId,
        studentId: student.id,
        classId,
        subjectId,
        teacherId: teacher.id,
        gradeValue: 87.5,
        gradeType: "EXAM",
        note: "ممتاز"
      }
    });

    await prisma.student.delete({ where: { id: student.id } });
    assert.equal(await prisma.gradeRecord.count({ where: { id: firstGrade.id } }), 0);

    const secondGrade = await prisma.gradeRecord.create({
      data: {
        schoolId,
        studentId: anotherStudent.id,
        classId,
        subjectId: anotherSubject.id,
        teacherId: teacher.id,
        gradeValue: 91,
        gradeType: "QUIZ",
        note: "ممتاز جدًا"
      }
    });

    await prisma.subject.delete({ where: { id: anotherSubject.id } });
    assert.equal(await prisma.gradeRecord.count({ where: { id: secondGrade.id } }), 0);
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("backup and report export records upsert cleanly without duplicating storage rows", async () => {
  const runId = makeRunId();
  const schoolId = `db-school-${runId}`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `DB Artifacts ${runId}`,
      address: "Test address",
      managerName: "Test Manager",
      institutionCode: `AR${runId.toUpperCase()}`,
      isActive: true
    }
  });

  try {
    const operator = await prisma.user.create({
      data: {
        schoolId,
        name: `DB Operator ${runId}`,
        email: `operator-${runId}@db-e2e.local`,
        password: "hash",
        role: "ADMIN"
      }
    });

    const initialReport = await createReportExportRecord(prisma, {
      schoolId,
      reportType: "attendance",
      fileType: "xlsx",
      filePath: `/tmp/report-${runId}.xlsx`,
      requestedBy: operator.id,
      status: "REQUESTED"
    });

    const updatedReport = await createReportExportRecord(prisma, {
      schoolId,
      reportType: "attendance",
      fileType: "xlsx",
      filePath: `/tmp/report-${runId}.xlsx`,
      requestedBy: operator.id,
      status: "READY"
    });

    assert.equal(initialReport.id, updatedReport.id);
    assert.equal(updatedReport.status, "READY");
    assert.equal(updatedReport.requestedBy, operator.id);

    const initialBackup = await createBackupJobRecord(prisma, {
      schoolId,
      backupType: "FULL",
      filePath: `/tmp/backup-${runId}.zip`,
      checksum: `checksum-${runId}`,
      encrypted: true,
      status: "PENDING",
      createdBy: operator.id
    });

    const completedBackup = await completeBackupJobRecord(prisma, initialBackup.id, {
      status: "COMPLETED",
      finishedAt: new Date(),
      checksum: `checksum-${runId}-done`
    });

    const updatedBackup = await createBackupJobRecord(prisma, {
      schoolId,
      backupType: "FULL",
      filePath: `/tmp/backup-${runId}.zip`,
      checksum: `checksum-${runId}-new`,
      encrypted: true,
      status: "COMPLETED",
      createdBy: operator.id
    });

    assert.equal(initialBackup.id, completedBackup.id);
    assert.equal(completedBackup.status, "COMPLETED");
    assert.equal(completedBackup.createdBy, operator.id);
    assert.equal(completedBackup.filePath, `/tmp/backup-${runId}.zip`);
    assert.equal(updatedBackup.id, completedBackup.id);
    assert.equal(updatedBackup.checksum, `checksum-${runId}-new`);
    assert.equal(updatedBackup.status, "COMPLETED");
  } finally {
    await cleanupSchoolData(schoolId);
  }
});

test("Arabic text survives a database round trip unchanged", async () => {
  const runId = makeRunId();
  const { schoolId, classId } = await createSchoolFixture(runId);

  try {
    const createdStudent = await prisma.student.create({
      data: {
        schoolId,
        classId,
        name: "الطالب أحمد بن علي",
        firstName: "أحمد",
        lastName: "بن علي",
        fatherName: "علي",
        motherName: "سميرة",
        nationalId: `AR-${runId}`,
        studentPhone: "0501234567"
      }
    });

    const roundTripStudent = await prisma.student.findUnique({
      where: { id: createdStudent.id }
    });

    assert.equal(roundTripStudent?.name, "الطالب أحمد بن علي");
    assert.equal(roundTripStudent?.firstName, "أحمد");
    assert.equal(roundTripStudent?.lastName, "بن علي");
    assert.equal(roundTripStudent?.fatherName, "علي");
    assert.equal(roundTripStudent?.motherName, "سميرة");

    const attendance = await prisma.studentAttendance.create({
      data: {
        schoolId,
        studentId: createdStudent.id,
        date: "2026-07-23",
        day: "الخميس",
        status: "ABSENT_EXCUSED",
        note: "غياب بعذر"
      }
    });

    assert.equal(attendance.day, "الخميس");
    assert.equal(attendance.note, "غياب بعذر");
  } finally {
    await cleanupSchoolData(schoolId);
  }
});
