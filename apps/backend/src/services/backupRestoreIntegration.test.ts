import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

type DockerResult = ReturnType<typeof spawnSync>;

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeDatabaseName(runId: string) {
  return `som_backup_${runId.replace(/[^a-zA-Z0-9_]/g, "_")}`;
}

function assertDockerResult(result: DockerResult, label: string) {
  if (result.status !== 0) {
    throw new Error(
      `${label} failed with code ${result.status ?? "unknown"}: ${(result.stderr || result.stdout || "").toString().slice(0, 1000)}`
    );
  }
}

function runDockerCommand(args: string[], options?: { input?: string }) {
  const dockerConfigDir = path.join(tmpdir(), "som-docker-config");
  const dockerHomeDir = path.join(tmpdir(), "som-docker-home");
  mkdirSync(dockerConfigDir, { recursive: true });
  mkdirSync(dockerHomeDir, { recursive: true });
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    input: options?.input,
    env: {
      ...process.env,
      DOCKER_CONFIG: dockerConfigDir,
      HOME: dockerHomeDir,
      USERPROFILE: dockerHomeDir
    }
  });
}

function createTemporaryDatabase(databaseName: string) {
  const result = runDockerCommand([
    "exec",
    "sompro_postgres",
    "psql",
    "-U",
    "som_user",
    "-d",
    "som",
    "-c",
    `CREATE DATABASE ${databaseName};`
  ]);
  assertDockerResult(result, `create database ${databaseName}`);
}

function dropTemporaryDatabase(databaseName: string, allowPermissionDenied = false) {
  const result = runDockerCommand([
    "exec",
    "sompro_postgres",
    "psql",
    "-U",
    "som_user",
    "-d",
    "som",
    "-c",
    `DROP DATABASE IF EXISTS ${databaseName};`
  ]);
  if (allowPermissionDenied && result.status !== 0) {
    const output = `${result.stderr || result.stdout || ""}`.toLowerCase();
    if (output.includes("permission denied while trying to connect to the docker api")) {
      return;
    }
  }
  assertDockerResult(result, `drop database ${databaseName}`);
}

function dumpDatabase(databaseName: string, backupPath: string) {
  const result = runDockerCommand([
    "exec",
    "sompro_postgres",
    "pg_dump",
    "-U",
    "som_user",
    "-d",
    databaseName,
    "--no-owner",
    "--no-acl"
  ]);
  assertDockerResult(result, `backup dump ${databaseName}`);
  writeFileSync(backupPath, result.stdout || "", "utf8");
}

function restoreDatabase(databaseName: string, backupPath: string) {
  const backupSql = readFileSync(backupPath, "utf8");
  const result = runDockerCommand(
    ["exec", "-i", "sompro_postgres", "psql", "-v", "ON_ERROR_STOP=1", "-U", "som_user", "-d", databaseName],
    { input: backupSql }
  );
  assertDockerResult(result, `restore dump ${databaseName}`);
}

function runMigrations(databaseUrl: string) {
  const result = spawnSync("cmd.exe", ["/d", "/s", "/c", "npm.cmd run prisma:migrate:deploy"], {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl
    },
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  assertDockerResult(result, "prisma migrate deploy");
}

function createClient(databaseUrl: string) {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  });
}

function canUseDocker() {
  const result = runDockerCommand(["version"]);
  if (result.status === 0) {
    return true;
  }

  const output = `${result.stderr || result.stdout || ""}`.toLowerCase();
  if (output.includes("permission denied while trying to connect to the docker api")) {
    return false;
  }

  throw new Error(`docker version failed with code ${result.status ?? "unknown"}: ${output.slice(0, 500)}`);
}

const runBackupRestoreTest = canUseDocker() ? test : test.skip;

runBackupRestoreTest(
  "backup and restore round trip preserves students, teachers, attendance, grades, files, and permissions",
  async () => {
    const runId = makeRunId();
    const databaseName = makeDatabaseName(runId);
    const databaseUrl = `postgresql://som_user:som_password@localhost:5432/${databaseName}?schema=public`;
    const backupDir = mkdtempSync(path.join(tmpdir(), "som-backup-"));
    const backupPath = path.join(backupDir, `backup-${runId}.sql`);
    let prisma = createClient(databaseUrl);

    try {
      createTemporaryDatabase(databaseName);
      runMigrations(databaseUrl);

      const school = await prisma.school.create({
        data: {
          id: `school-${runId}`,
          name: "مدرسة النسخ الاحتياطي",
          address: "القدس",
          managerName: "مدير النسخ",
          institutionCode: `BK${runId.toUpperCase()}`,
          isActive: true
        }
      });

      const role = await prisma.role.create({
        data: {
          schoolId: school.id,
          name: "MANAGER",
          description: "مدير المدرسة"
        }
      });

      const permission = await prisma.permission.create({
        data: {
          key: `manage_backup_${runId}`,
          description: "صلاحية إدارة النسخ الاحتياطي"
        }
      });

      const user = await prisma.user.create({
        data: {
          schoolId: school.id,
          name: "أمين النظام",
          email: `backup-${runId}@example.com`,
          password: "hashed-password-placeholder",
          role: "MANAGER"
        }
      });

      await prisma.userRoleAssignment.create({
        data: {
          schoolId: school.id,
          userId: user.id,
          roleId: role.id
        }
      });

      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      });

      const teacher = await prisma.teacher.create({
        data: {
          schoolId: school.id,
          name: "المعلمة ليان",
          employeeNumber: `EMP-${runId}`,
          specialty: "رياضيات",
          nationalId: `T-${runId}`
        }
      });

      const schoolClass = await prisma.schoolClass.create({
        data: {
          schoolId: school.id,
          name: "10 أ",
          gradeLevel: "10",
          section: "أ",
          homeroomTeacherId: teacher.id,
          maxStudents: 30
        }
      });

      const subject = await prisma.subject.create({
        data: {
          schoolId: school.id,
          name: "رياضيات",
          code: `MATH-${runId}`,
          maxMark: 100,
          passMark: 50
        }
      });

      await prisma.teacherSubject.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          subjectId: subject.id,
          classId: schoolClass.id
        }
      });

      const student = await prisma.student.create({
        data: {
          schoolId: school.id,
          classId: schoolClass.id,
          name: "الطالب أحمد",
          firstName: "أحمد",
          lastName: "علي",
          nationalId: `S-${runId}`,
          fatherName: "علي",
          motherName: "سلمى",
          guardianPhone: "0501112222",
          studentPhone: "0512223333"
        }
      });

      await prisma.studentAttendance.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          date: "2026-07-23",
          day: "الخميس",
          status: "PRESENT"
        }
      });

      await prisma.studentGradeEntry.create({
        data: {
          schoolId: school.id,
          classId: schoolClass.id,
          subjectId: subject.id,
          certificateType: "TERM1_BIMONTHLY",
          rows: {
            [student.id]: {
              quiz: "18",
              exam: "20"
            }
          }
        }
      });

      const homework = await prisma.teacherHomework.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          classId: schoolClass.id,
          subjectId: subject.id,
          date: "2026-07-23",
          day: "الخميس",
          kind: "HOMEWORK",
          title: "واجب الرياضيات",
          description: "حل مسائل الصفحة 10",
          attachment: "uploads/homework/worksheet-1.pdf"
        }
      });

      const lessonToday = await prisma.teacherLessonToday.create({
        data: {
          schoolId: school.id,
          teacherId: teacher.id,
          classId: schoolClass.id,
          subjectId: subject.id,
          date: "2026-07-23",
          day: "الخميس",
          period: 1,
          title: "درس الكسور",
          summary: "شرح الكسور الاعتيادية",
          status: "COMPLETED",
          attachments: "uploads/lesson/photo-1.png"
        }
      });

      const reportExport = await prisma.reportExport.create({
        data: {
          schoolId: school.id,
          reportType: "ATTENDANCE",
          fileType: "json",
          filePath: `reports/${school.id}/attendance-export.json`,
          requestedBy: user.id,
          status: "COMPLETED",
          expiresAt: new Date("2026-08-23T00:00:00.000Z")
        }
      });

      const backupJob = await prisma.backupJob.create({
        data: {
          schoolId: school.id,
          backupType: "FULL",
          filePath: `backups/${school.id}/backup-1.sql`,
          checksum: "checksum-before-restore",
          encrypted: true,
          status: "COMPLETED",
          startedAt: new Date("2026-07-23T00:00:00.000Z"),
          finishedAt: new Date("2026-07-23T00:05:00.000Z"),
          createdBy: user.id
        }
      });

      dumpDatabase(databaseName, backupPath);
      assert.ok(readFileSync(backupPath, "utf8").length > 0);

      await prisma.student.update({
        where: { id: student.id },
        data: { name: "الطالب المعدل بعد النسخة" }
      });
      await prisma.studentAttendance.update({
        where: {
          schoolId_studentId_date: {
            schoolId: school.id,
            studentId: student.id,
            date: "2026-07-23"
          }
        },
        data: { status: "LATE", lateAt: "08:15" }
      });
      await prisma.studentGradeEntry.update({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId: school.id,
            classId: schoolClass.id,
            subjectId: subject.id,
            certificateType: "TERM1_BIMONTHLY"
          }
        },
        data: {
          rows: {
            [student.id]: {
              quiz: "10",
              exam: "11"
            }
          }
        }
      });
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { name: "المعلمة المعدلة بعد النسخة" }
      });
      await prisma.teacherHomework.update({
        where: { id: homework.id },
        data: { attachment: "uploads/homework/changed-after-backup.pdf" }
      });
      await prisma.teacherLessonToday.update({
        where: { id: lessonToday.id },
        data: { attachments: "uploads/lesson/changed-after-backup.png" }
      });

      assert.equal((await prisma.student.findUnique({ where: { id: student.id } }))?.name, "الطالب المعدل بعد النسخة");
      assert.equal(
        (
          await prisma.studentAttendance.findUnique({
            where: {
              schoolId_studentId_date: {
                schoolId: school.id,
                studentId: student.id,
                date: "2026-07-23"
              }
            }
          })
        )?.status,
        "LATE"
      );

      await prisma.$disconnect();

      dropTemporaryDatabase(databaseName, true);
      createTemporaryDatabase(databaseName);
      restoreDatabase(databaseName, backupPath);

      prisma = createClient(databaseUrl);

      const restoredSchool = await prisma.school.findUnique({ where: { id: school.id } });
      const restoredTeacher = await prisma.teacher.findUnique({ where: { id: teacher.id } });
      const restoredClass = await prisma.schoolClass.findUnique({ where: { id: schoolClass.id } });
      const restoredSubject = await prisma.subject.findUnique({ where: { id: subject.id } });
      const restoredStudent = await prisma.student.findUnique({ where: { id: student.id } });
      const restoredAttendance = await prisma.studentAttendance.findUnique({
        where: {
          schoolId_studentId_date: {
            schoolId: school.id,
            studentId: student.id,
            date: "2026-07-23"
          }
        }
      });
      const restoredGradeEntry = await prisma.studentGradeEntry.findUnique({
        where: {
          schoolId_classId_subjectId_certificateType: {
            schoolId: school.id,
            classId: schoolClass.id,
            subjectId: subject.id,
            certificateType: "TERM1_BIMONTHLY"
          }
        }
      });
      const restoredHomework = await prisma.teacherHomework.findUnique({ where: { id: homework.id } });
      const restoredLessonToday = await prisma.teacherLessonToday.findUnique({ where: { id: lessonToday.id } });
      const restoredUserRole = await prisma.userRoleAssignment.findFirst({
        where: { schoolId: school.id, userId: user.id, roleId: role.id }
      });
      const restoredRolePermission = await prisma.rolePermission.findFirst({
        where: { roleId: role.id, permissionId: permission.id }
      });
      const restoredReportExport = await prisma.reportExport.findUnique({ where: { id: reportExport.id } });
      const restoredBackupJob = await prisma.backupJob.findUnique({ where: { id: backupJob.id } });

      assert.equal(restoredSchool?.name, "مدرسة النسخ الاحتياطي");
      assert.equal(restoredTeacher?.name, "المعلمة ليان");
      assert.equal(restoredClass?.homeroomTeacherId, teacher.id);
      assert.equal(restoredSubject?.name, "رياضيات");
      assert.equal(restoredStudent?.name, "الطالب أحمد");
      assert.equal(restoredStudent?.fatherName, "علي");
      assert.equal(restoredAttendance?.status, "PRESENT");
      assert.equal(restoredAttendance?.day, "الخميس");
      assert.deepEqual(restoredGradeEntry?.rows, {
        [student.id]: {
          quiz: "18",
          exam: "20"
        }
      });
      assert.equal(restoredHomework?.attachment, "uploads/homework/worksheet-1.pdf");
      assert.equal(restoredLessonToday?.attachments, "uploads/lesson/photo-1.png");
      assert.ok(restoredUserRole);
      assert.ok(restoredRolePermission);
      assert.equal(restoredReportExport?.filePath, `reports/${school.id}/attendance-export.json`);
      assert.equal(restoredBackupJob?.checksum, "checksum-before-restore");
      assert.equal(restoredSchool?.name.includes("النسخ الاحتياطي"), true);
      assert.equal(restoredStudent?.name.includes("المعدل بعد النسخة"), false);
    } finally {
      await prisma.$disconnect().catch(() => null);
      dropTemporaryDatabase(databaseName, true);
      rmSync(backupPath, { force: true });
      rmSync(backupDir, { recursive: true, force: true });
    }
  }
);
