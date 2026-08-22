import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../app";
import { prisma } from "../db/prisma";
import { createAuthToken, hashPassword } from "./authService";

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function usePrivacyLifecycleRuntimeEnv() {
  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  const originalDisableRateLimit = process.env.SOM_E2E_DISABLE_RATE_LIMIT;
  const originalRetentionDays = process.env.SOM_SCHOOL_EXPORT_RETENTION_DAYS;

  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  process.env.SOM_E2E_DISABLE_RATE_LIMIT = "true";
  process.env.SOM_SCHOOL_EXPORT_RETENTION_DAYS = "30";

  return () => {
    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    process.env.SOM_E2E_DISABLE_RATE_LIMIT = originalDisableRateLimit;
    process.env.SOM_SCHOOL_EXPORT_RETENTION_DAYS = originalRetentionDays;
  };
}

async function requestJson(baseUrl: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { response, text, body };
}

function assertNotContains(value: unknown, forbidden: string[]) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const item of forbidden) {
    assert.equal(serialized.includes(item), false, `privacy lifecycle evidence must not leak ${item}`);
  }
}

function assertNoSensitiveKeys(value: unknown, path = "$") {
  const forbiddenKeys = new Set([
    "password",
    "passwordHash",
    "mfaSecretEncrypted",
    "token",
    "tokenVersion",
    "licenseCode",
    "recoveryCode"
  ]);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;

  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(forbiddenKeys.has(key), false, `sensitive key ${path}.${key} must be excluded from lifecycle export`);
    assertNoSensitiveKeys(item, `${path}.${key}`);
  }
}

async function seedSchool(runId: string, suffix: string) {
  const schoolId = `privacy-${suffix}-school-${runId}`;
  const managerId = `privacy-${suffix}-manager-${runId}`;
  const schedulerId = `privacy-${suffix}-scheduler-${runId}`;
  const classId = `privacy-${suffix}-class-${runId}`;
  const studentId = `privacy-${suffix}-student-${runId}`;
  const passwordSecret = `Privacy-${suffix}-Password-Secret-${runId}`;
  const hashSecret = `privacy-${suffix}-hash-secret-${runId}`;
  const mfaSecret = `privacy-${suffix}-mfa-secret-${runId}`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Privacy ${suffix.toUpperCase()} School ${runId}`,
      address: `Privacy ${suffix} Address Secret`,
      managerName: `Privacy ${suffix} Manager Name`,
      institutionCode: `PRIV${suffix.toUpperCase()}${runId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`,
      isActive: true
    }
  });
  await prisma.schoolSettings.create({
    data: { schoolId, workingDays: ["Wednesday"], offDays: [], periodsPerDay: 7 }
  });
  await prisma.schoolClass.create({
    data: { id: classId, schoolId, name: `Privacy ${suffix} Class`, grade: "8", section: suffix.toUpperCase() }
  });
  await prisma.student.create({
    data: {
      id: studentId,
      schoolId,
      classId,
      name: `Privacy ${suffix} Student Secret ${runId}`,
      nationalId: `NAT-${suffix}-${runId}`,
      fatherName: `Father ${suffix} Secret`,
      motherName: `Mother ${suffix} Secret`,
      guardianPhone: `050-${suffix === "a" ? "1111111" : "2222222"}`
    }
  });
  await prisma.user.createMany({
    data: [
      {
        id: managerId,
        schoolId,
        name: `Privacy ${suffix} Manager`,
        email: `privacy-${suffix}-manager-${runId}@example.test`,
        password: passwordSecret,
        passwordHash: hashSecret,
        mfaEnabled: true,
        mfaMethod: "TOTP",
        mfaSecretEncrypted: mfaSecret,
        role: "MANAGER"
      },
      {
        id: schedulerId,
        schoolId,
        name: `Privacy ${suffix} Scheduler`,
        email: `privacy-${suffix}-scheduler-${runId}@example.test`,
        password: hashPassword(`Privacy-${suffix}-Scheduler-123!`),
        role: "SCHEDULER"
      }
    ]
  });
  await prisma.auditLog.create({
    data: {
      schoolId,
      userId: managerId,
      action: "PRIVACY_LEGACY_AUDIT_SEED",
      entity: "User",
      entityId: managerId,
      before: {
        password: passwordSecret,
        tokenVersion: 99,
        nested: { mfaSecretEncrypted: mfaSecret, recoveryCode: `privacy-${suffix}-recovery-secret-${runId}` }
      },
      after: {
        passwordHash: hashSecret,
        token: `privacy-${suffix}-token-secret-${runId}`
      }
    }
  });

  return {
    schoolId,
    managerId,
    schedulerId,
    classId,
    studentId,
    passwordSecret,
    hashSecret,
    mfaSecret,
    studentSecret: `Privacy ${suffix} Student Secret ${runId}`,
    managerToken: createAuthToken({ userId: managerId, schoolId, role: "MANAGER", tokenVersion: 0 }),
    schedulerToken: createAuthToken({ userId: schedulerId, schoolId, role: "SCHEDULER", tokenVersion: 0 })
  };
}

async function cleanupPrivacyLifecycle(runId: string) {
  const schoolIds = ["a", "b", "c"].map((suffix) => `privacy-${suffix}-school-${runId}`);
  await prisma.auditLog
    .deleteMany({ where: { OR: [{ schoolId: { in: schoolIds } }, { entityId: { contains: runId } }] } })
    .catch(() => null);
  await prisma.reportExport.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.backupJob.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentCertificate.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeEntry.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeScheme.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentBehaviorRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentAcademicRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentAttendance.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentNotification.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherHomeworkSubmission.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherHomework.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherExam.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherLessonToday.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.substitution.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailyEvent.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailyTeacherStatus.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.baseScheduleSlot.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.homeroomAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dutyAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.periodDefinition.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolSettings.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.student.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacher.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.subject.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolClass.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.user.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.licenseActivation.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailySchedule.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } }).catch(() => null);
}

test("privacy lifecycle export, anonymize, delete, audit, and retention evidence stays tenant scoped and secret-free", async () => {
  const restoreEnv = usePrivacyLifecycleRuntimeEnv();
  const runId = makeRunId();
  const schoolA = await seedSchool(runId, "a");
  const schoolB = await seedSchool(runId, "b");
  const schoolC = await seedSchool(runId, "c");
  const app = createApp();
  let server: Server | null = null;
  const baseUrl = await new Promise<string>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });

  try {
    const forbiddenSecrets = [
      schoolA.passwordSecret,
      schoolA.hashSecret,
      schoolA.mfaSecret,
      `privacy-a-recovery-secret-${runId}`,
      `privacy-a-token-secret-${runId}`,
      schoolB.schoolId,
      schoolB.studentId,
      schoolB.studentSecret
    ];

    const schedulerExport = await requestJson(
      baseUrl,
      `/api/schools/${encodeURIComponent(schoolA.schoolId)}/export-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${schoolA.schedulerToken}` }
      }
    );
    assert.equal(schedulerExport.response.status, 403, schedulerExport.text);
    assertNotContains(schedulerExport.body, forbiddenSecrets);

    const crossTenantExport = await requestJson(
      baseUrl,
      `/api/schools/${encodeURIComponent(schoolB.schoolId)}/export-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${schoolA.managerToken}` }
      }
    );
    assert.equal(crossTenantExport.response.status, 403, crossTenantExport.text);
    assertNotContains(crossTenantExport.body, forbiddenSecrets);

    const schoolExport = await requestJson(
      baseUrl,
      `/api/schools/${encodeURIComponent(schoolA.schoolId)}/export-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${schoolA.managerToken}` }
      }
    );
    assert.equal(schoolExport.response.status, 200, schoolExport.text);
    const schoolExportBody = schoolExport.body as {
      data?: Record<string, unknown>;
      lifecycle?: Record<string, unknown>;
      reportExport?: { filePath?: string };
    };
    assert.equal(schoolExportBody.lifecycle?.storedArtifactEncrypted, true);
    assert.equal(schoolExportBody.lifecycle?.retentionDays, 30);
    assert.equal(schoolExportBody.lifecycle?.auditRetained, true);
    assert.match(String(schoolExportBody.reportExport?.filePath || ""), /\.json\.enc$/);
    assertNoSensitiveKeys(schoolExportBody.data);
    assertNotContains(schoolExportBody.data, forbiddenSecrets);
    assert.equal(JSON.stringify(schoolExportBody.data).includes(schoolA.studentId), true);

    const exportBackupJob = await prisma.backupJob.findFirst({
      where: { schoolId: schoolA.schoolId, backupType: "SCHOOL_EXPORT_SNAPSHOT" },
      orderBy: { startedAt: "desc" }
    });
    assert.ok(exportBackupJob, "school export must create backup/export artifact evidence");
    assert.equal(exportBackupJob.encrypted, true);
    assert.match(exportBackupJob.filePath, /\.json\.enc$/);

    const auditExport = await fetch(`${baseUrl}/api/audit-logs/export`, {
      headers: { Authorization: `Bearer ${schoolA.managerToken}` }
    });
    const auditExportText = await auditExport.text();
    assert.equal(auditExport.status, 200, auditExportText);
    assertNotContains(auditExportText, forbiddenSecrets);

    const anonymize = await requestJson(baseUrl, `/api/schools/${encodeURIComponent(schoolA.schoolId)}/delete-data`, {
      method: "POST",
      headers: { Authorization: `Bearer ${schoolA.managerToken}` },
      body: JSON.stringify({ confirm: true, mode: "ANONYMIZE", reason: "privacy lifecycle drill" })
    });
    assert.equal(anonymize.response.status, 200, anonymize.text);
    const anonymizedStudent = await prisma.student.findUniqueOrThrow({ where: { id: schoolA.studentId } });
    assert.equal(anonymizedStudent.status, "ARCHIVED");
    assert.notEqual(anonymizedStudent.name, schoolA.studentSecret);
    assert.equal(anonymizedStudent.nationalId, null);
    assert.equal(anonymizedStudent.guardianPhone, null);
    const anonymizedUser = await prisma.user.findUniqueOrThrow({ where: { id: schoolA.managerId } });
    assert.equal(anonymizedUser.status, "ARCHIVED");
    assert.equal(anonymizedUser.mfaEnabled, false);
    assert.equal(anonymizedUser.mfaSecretEncrypted, null);
    const anonymizeAudit = await prisma.auditLog.findFirst({
      where: { schoolId: schoolA.schoolId, action: "SCHOOL_ANONYMIZE_DATA" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(anonymizeAudit, "anonymize lifecycle operation must be audited");
    assertNotContains(anonymizeAudit, forbiddenSecrets);

    const deleteSchool = await requestJson(
      baseUrl,
      `/api/schools/${encodeURIComponent(schoolC.schoolId)}/delete-data`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${schoolC.managerToken}` },
        body: JSON.stringify({ confirm: true, mode: "DELETE", reason: "end of contract purge drill" })
      }
    );
    assert.equal(deleteSchool.response.status, 200, deleteSchool.text);
    const deletedSchool = await prisma.school.findUniqueOrThrow({ where: { id: schoolC.schoolId } });
    assert.equal(deletedSchool.status, "DELETED");
    assert.equal(deletedSchool.isActive, false);
    assert.equal(await prisma.student.count({ where: { schoolId: schoolC.schoolId } }), 0);
    assert.equal(await prisma.user.count({ where: { schoolId: schoolC.schoolId } }), 0);
    const deleteAudit = await prisma.auditLog.findFirst({
      where: { schoolId: schoolC.schoolId, action: "SCHOOL_DELETE_DATA" },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(deleteAudit, "delete lifecycle must leave an audit record tied to schoolId");
    assert.equal((deleteAudit.after as { actorUserId?: string })?.actorUserId, schoolC.managerId);
    assertNotContains(deleteAudit, [schoolC.passwordSecret, schoolC.hashSecret, schoolC.mfaSecret]);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await cleanupPrivacyLifecycle(runId);
    restoreEnv();
  }
});
