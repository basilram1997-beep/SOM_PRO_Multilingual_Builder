import { Prisma, type UserRole } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { z } from "zod";
import { SchoolInfoSchema } from "@som/shared";
import { env } from "../../config/env";
import { prisma } from "../../db/prisma";
import { rejectMultipartContent } from "../../middleware/requestProtections";
import { validateBody } from "../../middleware/validate";
import { canRole } from "../../services/accessPolicy";
import { logSafeError } from "../../lib/safeLog";
import { getRequestSchoolId } from "../../services/schoolContext";
import { ensureSchoolSettings } from "../../services/schoolSettings";
import { recordAuditLog } from "../../services/auditLog";
import { createBackupJobRecord, createReportExportRecord } from "../../services/artifactRecords";
import { getLicenseState } from "../../services/licenseService";
import { getRequestDeviceInfo } from "../../services/deviceContext";

export const schoolsRouter = Router();
schoolsRouter.use(rejectMultipartContent);

const SchoolCreateSchema = SchoolInfoSchema;
const SchoolDeactivateSchema = z.object({ reason: z.string().trim().optional().nullable() });
const SchoolDeletionSchema = z.object({
  confirm: z.literal(true),
  mode: z.enum(["DELETE", "ANONYMIZE"]).default("DELETE"),
  reason: z.string().trim().optional().nullable()
});

function canAccessSchool(reqSchoolId: string, targetSchoolId: string) {
  return reqSchoolId === targetSchoolId;
}

function canManageSchoolOperations(role: UserRole | undefined) {
  return Boolean(role && canRole(role, "manageSettings"));
}

function canUseOperatorHealth() {
  return env.appEnv !== "production" || process.env.SOM_ENABLE_OPERATOR_HEALTH === "true";
}

async function checkDatabaseHealth() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      ok: true,
      latencyMs: Date.now() - startedAt,
      message: "reachable"
    };
  } catch (error) {
    logSafeError("schools.operatorHealth.database", error);
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      message: "unreachable"
    };
  }
}

function readStorageHealth() {
  const targetPath = path.resolve(process.env.SOM_STORAGE_PATH || process.cwd());
  try {
    const stats = fs.statfsSync(targetPath);
    const totalBytes = Number(stats.blocks) * Number(stats.bsize);
    const availableBytes = Number(stats.bavail) * Number(stats.bsize);
    const usedBytes = Math.max(totalBytes - availableBytes, 0);
    const usedPercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : null;
    return {
      ok: true,
      path: targetPath,
      totalBytes,
      availableBytes,
      usedPercent,
      message: "available"
    };
  } catch (error) {
    logSafeError("schools.operatorHealth.storage", error);
    return {
      ok: false,
      path: targetPath,
      totalBytes: null,
      availableBytes: null,
      usedPercent: null,
      message: "unavailable"
    };
  }
}

async function buildSchoolDashboard(schoolId: string) {
  const settings = await ensureSchoolSettings(schoolId);
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  const teacherIds = (await prisma.teacher.findMany({ where: { schoolId }, select: { id: true } })).map(
    (item) => item.id
  );
  const [teachers, classes, subjects, baseSlots, assignments, archiveDays, homeroomAssignments, daily] =
    await Promise.all([
      prisma.teacher.count({ where: { schoolId } }),
      prisma.schoolClass.count({ where: { schoolId } }),
      prisma.subject.count({ where: { schoolId } }),
      prisma.baseScheduleSlot.count({ where: { schoolId } }),
      prisma.teacherAssignment.count({ where: { teacherId: { in: teacherIds } } }),
      prisma.dailySchedule.count({ where: { schoolId } }),
      prisma.homeroomAssignment.count({ where: { schoolId } }),
      prisma.dailySchedule.findFirst({
        where: { schoolId },
        include: { statuses: true, substitutions: true },
        orderBy: { date: "desc" }
      })
    ]);

  const today = daily
    ? {
        date: daily.date,
        absent: daily.statuses.filter((status) => status.type === "ABSENT").length,
        late: daily.statuses.filter((status) => status.type === "LATE").length,
        left: daily.statuses.filter((status) => status.type === "LEFT").length,
        substitutions: daily.substitutions.length,
        affectedClasses: new Set(daily.substitutions.map((item) => item.classId)).size
      }
    : {
        date: new Date().toISOString().slice(0, 10),
        absent: 0,
        late: 0,
        left: 0,
        substitutions: 0,
        affectedClasses: 0
      };

  return {
    school: {
      id: school?.id || schoolId,
      name: school?.name || "-",
      address: school?.address || "-",
      managerName: school?.managerName || "مدير المدرسة",
      institutionCode: school?.institutionCode || "000000",
      isActive: school?.isActive ?? true
    },
    teachers,
    classes,
    subjects,
    baseSlots,
    assignments,
    archiveDays,
    homeroomAssignments,
    periodsPerDay: settings.periodsPerDay,
    workingDays: settings.workingDays,
    offDays: settings.offDays,
    maxTeachers: settings.maxTeachers,
    today
  };
}

async function exportSchoolData(schoolId: string) {
  const [
    school,
    settings,
    periods,
    users,
    teachers,
    classes,
    subjects,
    students,
    attendance,
    academicRecords,
    behaviorRecords,
    certificates,
    gradeSchemes,
    gradeEntries,
    lessonTodayEntries,
    homeworkEntries,
    exams,
    schedules,
    dailySchedules,
    homeroomAssignments,
    duties,
    reportExports,
    backupJobs,
    auditLogs
  ] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.schoolSettings.findUnique({ where: { schoolId } }),
    prisma.periodDefinition.findMany({ where: { schoolId }, orderBy: { period: "asc" } }),
    prisma.user.findMany({ where: { schoolId }, orderBy: { createdAt: "asc" } }),
    prisma.teacher.findMany({ where: { schoolId }, orderBy: { name: "asc" }, include: { assignments: true } }),
    prisma.schoolClass.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.subject.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.student.findMany({ where: { schoolId }, orderBy: { name: "asc" } }),
    prisma.studentAttendance.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.studentAcademicRecord.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.studentBehaviorRecord.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] }),
    prisma.studentCertificate.findMany({
      where: { schoolId },
      orderBy: [{ academicYear: "asc" }, { createdAt: "asc" }]
    }),
    prisma.studentGradeScheme.findMany({ where: { schoolId }, orderBy: [{ classId: "asc" }, { subjectId: "asc" }] }),
    prisma.studentGradeEntry.findMany({ where: { schoolId }, orderBy: [{ classId: "asc" }, { subjectId: "asc" }] }),
    prisma.teacherLessonToday.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { period: "asc" }] }),
    prisma.teacherHomework.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { title: "asc" }] }),
    prisma.teacherExam.findMany({ where: { schoolId }, orderBy: [{ date: "asc" }, { startTime: "asc" }] }),
    prisma.baseScheduleSlot.findMany({ where: { schoolId }, orderBy: [{ day: "asc" }, { period: "asc" }] }),
    prisma.dailySchedule.findMany({
      where: { schoolId },
      include: { statuses: true, substitutions: true, events: true },
      orderBy: [{ date: "asc" }]
    }),
    prisma.homeroomAssignment.findMany({
      where: { schoolId },
      orderBy: [{ weeklyDay: "asc" }, { weeklyPeriod: "asc" }]
    }),
    prisma.dutyAssignment.findMany({ where: { schoolId }, orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
    prisma.reportExport.findMany({ where: { schoolId }, orderBy: [{ createdAt: "asc" }] }),
    prisma.backupJob.findMany({ where: { schoolId }, orderBy: [{ startedAt: "asc" }] }),
    prisma.auditLog.findMany({ where: { schoolId }, orderBy: [{ createdAt: "asc" }] })
  ]);

  return {
    school,
    settings,
    periods,
    users,
    teachers,
    classes,
    subjects,
    students,
    attendance,
    academicRecords,
    behaviorRecords,
    certificates,
    gradeSchemes,
    gradeEntries,
    lessonTodayEntries,
    homeworkEntries,
    exams,
    schedules,
    dailySchedules,
    homeroomAssignments,
    duties,
    reportExports,
    backupJobs,
    auditLogs
  };
}

schoolsRouter.get("/operations", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSchoolOperations(req.user?.role)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "ليس لديك صلاحية عرض عمليات المدرسة" });
  }

  try {
    const [school, reportExports, backupJobs] = await Promise.all([
      prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, name: true, institutionCode: true } }),
      prisma.reportExport.findMany({
        where: { schoolId },
        orderBy: [{ createdAt: "desc" }],
        take: 12,
        include: {
          requestedByUser: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.backupJob.findMany({
        where: { schoolId },
        orderBy: [{ startedAt: "desc" }],
        take: 12,
        include: {
          createdByUser: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    if (!school) {
      return res.status(404).json({ error: "SCHOOL_NOT_FOUND", message: "المدرسة غير موجودة" });
    }

    res.json({
      data: {
        school,
        schoolId,
        generatedAt: new Date().toISOString(),
        auditLogExport: {
          path: "/api/audit-logs/export",
          format: "jsonl",
          privacyWarning: true,
          expiresImmediately: false
        },
        reportExports: reportExports.map((item) => ({
          id: item.id,
          reportType: item.reportType,
          fileType: item.fileType,
          filePath: item.filePath,
          requestedBy: item.requestedBy,
          requestedByName: item.requestedByUser?.name || item.requestedByUser?.email || null,
          status: item.status,
          createdAt: item.createdAt.toISOString(),
          expiresAt: item.expiresAt ? item.expiresAt.toISOString() : null
        })),
        backupJobs: backupJobs.map((item) => ({
          id: item.id,
          backupType: item.backupType,
          filePath: item.filePath,
          checksum: item.checksum,
          encrypted: item.encrypted,
          status: item.status,
          startedAt: item.startedAt.toISOString(),
          finishedAt: item.finishedAt ? item.finishedAt.toISOString() : null,
          createdBy: item.createdBy,
          createdByName: item.createdByUser?.name || item.createdByUser?.email || null
        }))
      }
    });
  } catch (error) {
    logSafeError("schools.operations", error);
    res.status(500).json({ error: "OPERATIONS_LOAD_FAILED", message: "تعذر تحميل لوحة العمليات" });
  }
});

schoolsRouter.get("/operator-health", async (req, res) => {
  const schoolId = await getRequestSchoolId(req);
  if (!canManageSchoolOperations(req.user?.role)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "ليس لديك صلاحية عرض صحة التشغيل" });
  }

  if (!canUseOperatorHealth()) {
    return res.status(404).json({ error: "NOT_FOUND", message: "صفحة صحة التشغيل غير مفعلة في هذه النسخة" });
  }

  try {
    const [database, license, lastBackup] = await Promise.all([
      checkDatabaseHealth(),
      getLicenseState(schoolId, getRequestDeviceInfo(req)),
      prisma.backupJob.findFirst({
        where: { schoolId },
        orderBy: [{ startedAt: "desc" }],
        select: {
          id: true,
          backupType: true,
          status: true,
          encrypted: true,
          filePath: true,
          startedAt: true,
          finishedAt: true
        }
      })
    ]);

    const generatedAt = new Date().toISOString();
    res.json({
      data: {
        generatedAt,
        database,
        license: {
          status: license.status,
          plan: license.plan,
          expiresAt: license.expiresAt,
          readOnly: license.readOnly,
          readOnlyReason: license.readOnlyReason || null,
          activeDevicesCount: license.activeDevicesCount ?? null,
          maxDevices: license.maxDevices
        },
        backup: lastBackup
          ? {
              id: lastBackup.id,
              backupType: lastBackup.backupType,
              status: lastBackup.status,
              encrypted: lastBackup.encrypted,
              filePath: lastBackup.filePath,
              startedAt: lastBackup.startedAt.toISOString(),
              finishedAt: lastBackup.finishedAt ? lastBackup.finishedAt.toISOString() : null
            }
          : null,
        version: {
          product: "SOM PRO",
          version: process.env.SOM_VERSION || "0.9.0-rc.1",
          releaseChannel: process.env.SOM_RELEASE_CHANNEL || "release-candidate",
          runtimeMode: process.env.SOM_RUNTIME_MODE || env.appEnv,
          apiEnvironment: process.env.SOM_API_ENV || env.appEnv,
          nodeVersion: process.version
        },
        storage: readStorageHealth(),
        lastCheck: {
          at: generatedAt,
          source: "backend"
        }
      },
      error: null
    });
  } catch (error) {
    logSafeError("schools.operatorHealth", error);
    res.status(500).json({ error: "OPERATOR_HEALTH_LOAD_FAILED", message: "تعذر تحميل تقرير صحة التشغيل" });
  }
});

async function deleteSchoolData(schoolId: string) {
  await prisma.$transaction([
    prisma.studentCertificate.deleteMany({ where: { schoolId } }),
    prisma.studentGradeEntry.deleteMany({ where: { schoolId } }),
    prisma.studentGradeScheme.deleteMany({ where: { schoolId } }),
    prisma.studentBehaviorRecord.deleteMany({ where: { schoolId } }),
    prisma.studentAcademicRecord.deleteMany({ where: { schoolId } }),
    prisma.studentAttendance.deleteMany({ where: { schoolId } }),
    prisma.studentNotification.deleteMany({ where: { schoolId } }),
    prisma.teacherHomeworkSubmission.deleteMany({ where: { schoolId } }),
    prisma.teacherHomework.deleteMany({ where: { schoolId } }),
    prisma.teacherExam.deleteMany({ where: { schoolId } }),
    prisma.teacherLessonToday.deleteMany({ where: { schoolId } }),
    prisma.substitution.deleteMany({ where: { schoolId } }),
    prisma.dailyEvent.deleteMany({ where: { schoolId } }),
    prisma.dailyTeacherStatus.deleteMany({ where: { schoolId } }),
    prisma.baseScheduleSlot.deleteMany({ where: { schoolId } }),
    prisma.teacherAssignment.deleteMany({ where: { schoolId } }),
    prisma.homeroomAssignment.deleteMany({ where: { schoolId } }),
    prisma.dutyAssignment.deleteMany({ where: { schoolId } }),
    prisma.reportExport.deleteMany({ where: { schoolId } }),
    prisma.backupJob.deleteMany({ where: { schoolId } }),
    prisma.periodDefinition.deleteMany({ where: { schoolId } }),
    prisma.schoolSettings.deleteMany({ where: { schoolId } }),
    prisma.student.deleteMany({ where: { schoolId } }),
    prisma.teacher.deleteMany({ where: { schoolId } }),
    prisma.subject.deleteMany({ where: { schoolId } }),
    prisma.schoolClass.deleteMany({ where: { schoolId } }),
    prisma.user.deleteMany({ where: { schoolId } }),
    prisma.auditLog.deleteMany({ where: { schoolId } }),
    prisma.licenseActivation.deleteMany({ where: { schoolId } }),
    prisma.dailySchedule.deleteMany({ where: { schoolId } }),
    prisma.school.delete({ where: { id: schoolId } })
  ]);
}

function buildOperationReport(type: string, schoolId: string, snapshot: Awaited<ReturnType<typeof exportSchoolData>>) {
  return {
    type,
    schoolId,
    generatedAt: new Date().toISOString(),
    counts: {
      users: snapshot.users.length,
      teachers: snapshot.teachers.length,
      classes: snapshot.classes.length,
      subjects: snapshot.subjects.length,
      students: snapshot.students.length,
      attendance: snapshot.attendance.length,
      grades: snapshot.gradeEntries.length,
      logs: snapshot.auditLogs.length,
      exports: snapshot.reportExports.length,
      backups: snapshot.backupJobs.length
    }
  };
}

async function anonymizeSchoolData(schoolId: string, snapshot: Awaited<ReturnType<typeof exportSchoolData>>) {
  const stamp = Date.now().toString(36);
  const school = snapshot.school;
  const batch: unknown[] = [];

  for (const user of snapshot.users) {
    batch.push(
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: `مستخدم مؤرشف ${user.id.slice(-6)}`,
          fullName: null,
          email: `archived-${user.id}-${stamp}@deleted.local`,
          phone: null,
          password: crypto.randomBytes(24).toString("hex"),
          passwordHash: crypto.randomBytes(24).toString("hex"),
          externalIdentityProvider: null,
          externalUserId: null,
          ministryUserId: null,
          mfaEnabled: false,
          lastLoginAt: null,
          status: "ARCHIVED"
        }
      })
    );
  }

  for (const teacher of snapshot.teachers) {
    batch.push(
      prisma.teacher.update({
        where: { id: teacher.id },
        data: {
          name: `معلم مؤرشف ${teacher.id.slice(-6)}`,
          employeeNumber: null,
          externalId: null,
          nationalId: null,
          specialty: null,
          adminRole: null,
          notes: null,
          preferredDays: Prisma.JsonNull,
          preferredClasses: Prisma.JsonNull,
          preferredPeriods: Prisma.JsonNull,
          workDays: Prisma.JsonNull,
          releaseHours: 0,
          targetLoad: 0,
          status: "ARCHIVED"
        }
      })
    );
  }

  for (const student of snapshot.students) {
    batch.push(
      prisma.student.update({
        where: { id: student.id },
        data: {
          name: `طالب مؤرشف ${student.id.slice(-6)}`,
          firstName: null,
          lastName: null,
          internalStudentNumber: null,
          externalId: null,
          nationalId: null,
          fatherName: null,
          motherName: null,
          residence: null,
          fatherPhone: null,
          motherPhone: null,
          guardianPhone: null,
          healthFund: null,
          studentPhone: null,
          status: "ARCHIVED"
        }
      })
    );
  }

  for (const schoolClass of snapshot.classes) {
    batch.push(
      prisma.schoolClass.update({
        where: { id: schoolClass.id },
        data: {
          name: `صف مؤرشف ${schoolClass.id.slice(-6)}`,
          gradeLevel: null,
          grade: null,
          section: null,
          homeroomTeacherId: null,
          status: "ARCHIVED"
        }
      })
    );
  }

  for (const subject of snapshot.subjects) {
    batch.push(
      prisma.subject.update({
        where: { id: subject.id },
        data: {
          name: `مادة مؤرشفة ${subject.id.slice(-6)}`,
          code: null,
          status: "ARCHIVED"
        }
      })
    );
  }

  await prisma.school.update({
    where: { id: schoolId },
    data: {
      name: `${school?.name || "مدرسة"} - مؤرشفة`,
      managerName: null,
      institutionCode: null,
      address: null,
      isActive: false
    }
  });

  await prisma.$transaction(batch as any);
}

schoolsRouter.post("/", validateBody(SchoolCreateSchema), async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const school = await prisma.school.create({
    data: {
      name: req.body.name.trim(),
      managerName: req.body.managerName?.trim() || null,
      institutionCode: req.body.institutionCode?.trim() || null,
      address: req.body.address?.trim() || null
    }
  });
  await ensureSchoolSettings(school.id);
  recordAuditLog(prisma, {
    schoolId: currentSchoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SCHOOL_CREATE",
    entity: "School",
    entityId: school.id,
    after: school as Prisma.InputJsonValue
  });
  res.status(201).json({ data: school });
});

schoolsRouter.get("/:id/dashboard", async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const schoolId = String(req.params.id);
  if (!canAccessSchool(currentSchoolId, schoolId)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "لا يمكن عرض لوحة مدرسة أخرى" });
  }

  const dashboard = await buildSchoolDashboard(schoolId);
  res.json({ data: dashboard });
});

schoolsRouter.put("/:id", validateBody(SchoolCreateSchema), async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const schoolId = String(req.params.id);
  if (!canAccessSchool(currentSchoolId, schoolId)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "لا يمكن تعديل مدرسة أخرى" });
  }

  const before = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!before) {
    return res.status(404).json({ error: "SCHOOL_NOT_FOUND", message: "لم يتم العثور على المدرسة" });
  }

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: {
      name: req.body.name.trim(),
      managerName: req.body.managerName?.trim() || null,
      institutionCode: req.body.institutionCode?.trim() || null,
      address: req.body.address?.trim() || null
    }
  });

  recordAuditLog(prisma, {
    schoolId: currentSchoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SCHOOL_UPDATE",
    entity: "School",
    entityId: schoolId,
    before: before as Prisma.InputJsonValue,
    after: school as Prisma.InputJsonValue
  });
  res.json({ data: school });
});

schoolsRouter.post("/:id/deactivate", validateBody(SchoolDeactivateSchema), async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const schoolId = String(req.params.id);
  if (!canManageSchoolOperations(req.user?.role) || !canAccessSchool(currentSchoolId, schoolId)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "ليس لديك صلاحية تنفيذ هذه العملية" });
  }

  const before = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!before) {
    return res.status(404).json({ error: "SCHOOL_NOT_FOUND", message: "المدرسة غير موجودة" });
  }

  const school = await prisma.school.update({
    where: { id: schoolId },
    data: { isActive: false }
  });

  recordAuditLog(prisma, {
    schoolId: currentSchoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SCHOOL_DEACTIVATE",
    entity: "School",
    entityId: schoolId,
    before: before as Prisma.InputJsonValue,
    after: {
      ...school,
      workflow: "SCHOOL_DEACTIVATED",
      usersBlocked: true,
      reason: req.body.reason || null
    } as Prisma.InputJsonValue
  });

  res.json({
    data: school,
    workflow: {
      step: "SCHOOL_DEACTIVATED",
      completedAt: new Date().toISOString(),
      usersBlocked: true,
      reason: req.body.reason || null
    }
  });
});

schoolsRouter.post("/:id/export-data", async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const schoolId = String(req.params.id);
  if (!canManageSchoolOperations(req.user?.role) || !canAccessSchool(currentSchoolId, schoolId)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "ليس لديك صلاحية تنفيذ هذه العملية" });
  }

  const snapshot = await exportSchoolData(schoolId);
  const now = new Date();
  const filePath = `backups/schools/${schoolId}/export-${now.toISOString().replace(/[:.]/g, "-")}.json`;
  const report = buildOperationReport("SCHOOL_EXPORT", schoolId, snapshot);
  const reportRecord = await createReportExportRecord(prisma, {
    schoolId,
    reportType: "SCHOOL_EXPORT_DATA",
    fileType: "json",
    filePath,
    requestedBy: req.user?.id || req.user?.userId || null,
    status: "COMPLETED",
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  });

  await createBackupJobRecord(prisma, {
    schoolId,
    backupType: "SCHOOL_EXPORT_SNAPSHOT",
    status: "COMPLETED",
    filePath,
    checksum: crypto.createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    encrypted: false,
    startedAt: now,
    finishedAt: now,
    createdBy: req.user?.id || req.user?.userId || null
  });

  recordAuditLog(prisma, {
    schoolId: currentSchoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: "SCHOOL_EXPORT_DATA",
    entity: "School",
    entityId: schoolId,
    after: { exported: true, report, reportExportId: reportRecord.id } as Prisma.InputJsonValue
  });

  res.json({ data: snapshot, report, reportExport: reportRecord });
});

schoolsRouter.post("/:id/delete-data", validateBody(SchoolDeletionSchema), async (req, res) => {
  const currentSchoolId = await getRequestSchoolId(req);
  const schoolId = String(req.params.id);
  if (!canManageSchoolOperations(req.user?.role) || !canAccessSchool(currentSchoolId, schoolId)) {
    return res.status(403).json({ error: "FORBIDDEN", message: "ليس لديك صلاحية تنفيذ هذه العملية" });
  }

  const snapshot = await exportSchoolData(schoolId);
  const now = new Date();
  const report = buildOperationReport(
    req.body.mode === "ANONYMIZE" ? "SCHOOL_ANONYMIZE_DATA" : "SCHOOL_DELETE_DATA",
    schoolId,
    snapshot
  );
  const reportRecord = await createReportExportRecord(prisma, {
    schoolId,
    reportType: req.body.mode === "ANONYMIZE" ? "SCHOOL_ANONYMIZE_DATA" : "SCHOOL_DELETE_DATA",
    fileType: "json",
    filePath: `reports/schools/${schoolId}/${req.body.mode === "ANONYMIZE" ? "anonymize" : "delete"}-${now.toISOString().replace(/[:.]/g, "-")}.json`,
    requestedBy: req.user?.id || req.user?.userId || null,
    status: "COMPLETED",
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  });

  if (req.body.mode === "ANONYMIZE") {
    await anonymizeSchoolData(schoolId, snapshot);
  } else {
    await deleteSchoolData(schoolId);
  }

  recordAuditLog(prisma, {
    schoolId: currentSchoolId,
    userId: req.user?.id || req.user?.userId || null,
    action: req.body.mode === "ANONYMIZE" ? "SCHOOL_ANONYMIZE_DATA" : "SCHOOL_DELETE_DATA",
    entity: "School",
    entityId: schoolId,
    before: snapshot as Prisma.InputJsonValue,
    after: {
      confirmed: true,
      mode: req.body.mode,
      reason: req.body.reason || null,
      report,
      reportExportId: reportRecord.id
    } as Prisma.InputJsonValue
  });

  res.json({
    data: {
      confirmed: true,
      mode: req.body.mode,
      report,
      reportExport: reportRecord
    }
  });
});
