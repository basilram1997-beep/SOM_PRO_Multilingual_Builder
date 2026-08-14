import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { createApp } from "../app";
import { prisma } from "../db/prisma";
import { createAuthToken, hashPassword } from "./authService";

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function useNegativeApiRuntimeEnv() {
  const originalRequireCentral = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE;
  const originalCentralUrl = process.env.SOM_PRO_LICENSE_SERVER_URL;
  const originalLegacyCentralUrl = process.env.SOM_LICENSE_SERVER_URL;
  const originalRuntimeMode = process.env.SOM_RUNTIME_MODE;
  const originalDisableRateLimit = process.env.SOM_E2E_DISABLE_RATE_LIMIT;

  process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = "false";
  process.env.SOM_PRO_LICENSE_SERVER_URL = "";
  process.env.SOM_LICENSE_SERVER_URL = "";
  process.env.SOM_RUNTIME_MODE = "development";
  process.env.SOM_E2E_DISABLE_RATE_LIMIT = "true";

  return () => {
    process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE = originalRequireCentral;
    process.env.SOM_PRO_LICENSE_SERVER_URL = originalCentralUrl;
    process.env.SOM_LICENSE_SERVER_URL = originalLegacyCentralUrl;
    process.env.SOM_RUNTIME_MODE = originalRuntimeMode;
    process.env.SOM_E2E_DISABLE_RATE_LIMIT = originalDisableRateLimit;
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

function assertNoLeak(value: unknown, forbidden: string[]) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  for (const item of [
    ...forbidden,
    "PrismaClient",
    "Error:",
    "stack",
    "password",
    "tokenVersion",
    "createdAt"
  ]) {
    assert.equal(serialized.includes(item), false, `response must not leak ${item}`);
  }
  assert.doesNotMatch(serialized, /\n\s+at\s+\S+\s+\(.+:\d+:\d+\)/, "response must not leak stack frames");
}

async function seedNegativeApiUsers(runId: string) {
  const schoolAId = `negative-a-school-${runId}`;
  const schoolBId = `negative-b-school-${runId}`;
  const classAId = `negative-a-class-${runId}`;
  const classBId = `negative-b-class-${runId}`;
  const subjectAId = `negative-a-subject-${runId}`;
  const subjectBId = `negative-b-subject-${runId}`;
  const teacherId = `negative-teacher-${runId}`;
  const teacherProfileId = `negative-teacher-profile-${runId}`;
  const managerId = `negative-manager-${runId}`;
  const studentUserId = `negative-student-user-${runId}`;
  const password = "Negative-Api-123!";

  await prisma.school.createMany({
    data: [
      {
        id: schoolAId,
        name: `Negative A ${runId}`,
        address: "Jerusalem",
        managerName: "Manager A",
        institutionCode: `NEGA${runId.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
        isActive: true
      },
      {
        id: schoolBId,
        name: `Negative B ${runId}`,
        address: "Jerusalem",
        managerName: "Manager B",
        institutionCode: `NEGB${runId.replace(/[^a-z0-9]/gi, "").slice(0, 10)}`,
        isActive: true
      }
    ]
  });

  await prisma.schoolSettings.createMany({
    data: [
      { schoolId: schoolAId, workingDays: ["Wednesday"], offDays: [], periodsPerDay: 7 },
      { schoolId: schoolBId, workingDays: ["Wednesday"], offDays: [], periodsPerDay: 7 }
    ]
  });

  await prisma.schoolClass.createMany({
    data: [
      { id: classAId, schoolId: schoolAId, name: "Negative A Class", grade: "7", section: "A" },
      { id: classBId, schoolId: schoolBId, name: "Negative B Class", grade: "7", section: "B" }
    ]
  });

  await prisma.subject.createMany({
    data: [
      { id: subjectAId, schoolId: schoolAId, name: "Negative Math" },
      { id: subjectBId, schoolId: schoolAId, name: "Negative Science" }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        id: managerId,
        schoolId: schoolAId,
        name: "Negative Manager",
        email: `negative-manager-${runId}@example.test`,
        password: hashPassword(password),
        role: "MANAGER"
      },
      {
        id: teacherId,
        schoolId: schoolAId,
        name: "Negative Teacher",
        email: `negative-teacher-${runId}@example.test`,
        password: hashPassword(password),
        role: "TEACHER"
      },
      {
        id: studentUserId,
        schoolId: schoolAId,
        name: "Negative Student User",
        email: `negative-student-${runId}@example.test`,
        password: hashPassword(password),
        role: "STUDENT"
      }
    ]
  });

  await prisma.teacher.create({
    data: {
      id: teacherProfileId,
      schoolId: schoolAId,
      name: "Negative Teacher",
      assignments: {
        create: {
          schoolId: schoolAId,
          classId: classAId,
          subjectId: subjectAId,
          weeklyPeriods: 4
        }
      }
    }
  });

  const managerToken = createAuthToken({ userId: managerId, schoolId: schoolAId, role: "MANAGER", tokenVersion: 0 });
  const teacherToken = createAuthToken({ userId: teacherId, schoolId: schoolAId, role: "TEACHER", tokenVersion: 0 });
  const studentToken = createAuthToken({ userId: studentUserId, schoolId: schoolAId, role: "STUDENT", tokenVersion: 0 });

  return { schoolAId, schoolBId, classAId, classBId, subjectAId, subjectBId, managerToken, teacherToken, studentToken, runId };
}

async function cleanupNegativeApi(runId: string) {
  const schoolIds = [`negative-a-school-${runId}`, `negative-b-school-${runId}`];
  await prisma.auditLog.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeScheme.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeEntry.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacher.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.subject.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.student.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.user.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolClass.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolSettings.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } }).catch(() => null);
}

test("API rejects mass assignment, privilege escalation, malformed bodies, and unsafe error leakage", async () => {
  const restoreEnv = useNegativeApiRuntimeEnv();
  const runId = makeRunId();
  const seeded = await seedNegativeApiUsers(runId);
  const app = createApp();
  let server: Server | null = null;
  const baseUrl = await new Promise<string>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server!.address();
      assert.ok(address && typeof address === "object");
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
  const forbidden = [seeded.schoolBId, seeded.classBId, seeded.studentToken, seeded.teacherToken, "Negative-Api-123!"];

  try {
    const malformed = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{"
    });
    const malformedText = await malformed.text();
    assert.equal(malformed.status, 400, malformedText);
    assertNoLeak(malformedText, forbidden);

    const oversized = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "oversized@example.test", password: "x".repeat(2_200_000) })
    });
    const oversizedText = await oversized.text();
    assert.equal(oversized.status, 413, oversizedText);
    assertNoLeak(oversizedText, forbidden);

    const publicRoleEscalation = await requestJson(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Injected Admin",
        email: `injected-admin-${runId}@example.test`,
        password: "Injected-123!",
        role: "ADMIN",
        schoolId: seeded.schoolBId,
        tokenVersion: 999
      })
    });
    assert.equal(publicRoleEscalation.response.status, 400, publicRoleEscalation.text);
    assertNoLeak(publicRoleEscalation.body, forbidden);
    const injectedAdmin = await prisma.user.findFirst({ where: { email: `injected-admin-${runId}@example.test` } });
    assert.equal(injectedAdmin, null, "public registration must not create elevated users");

    const publicTeacherRegistration = await requestJson(baseUrl, "/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: "Public Teacher",
        email: `public-teacher-${runId}@example.test`,
        password: "Public-Teacher-123!",
        role: "TEACHER"
      })
    });
    assert.equal(publicTeacherRegistration.response.status, 400, publicTeacherRegistration.text);
    assertNoLeak(publicTeacherRegistration.body, forbidden);
    const publicTeacher = await prisma.user.findFirst({ where: { email: `public-teacher-${runId}@example.test` } });
    assert.equal(publicTeacher, null, "public registration must not create teacher accounts");

    const massAssignedStudent = await requestJson(baseUrl, "/api/students", {
      method: "POST",
      headers: { Authorization: `Bearer ${seeded.managerToken}` },
      body: JSON.stringify({
        name: "Mass Assigned Student",
        firstName: "Mass",
        lastName: "Assigned",
        classId: seeded.classAId,
        schoolId: seeded.schoolBId,
        userId: "attacker-user",
        role: "ADMIN",
        tokenVersion: 999,
        createdAt: "2000-01-01T00:00:00.000Z"
      })
    });
    assert.equal(massAssignedStudent.response.status, 400, massAssignedStudent.text);
    assert.match(massAssignedStudent.text, /INVALID_SCHOOL_CONTEXT|INVALID_USER_CONTEXT/);
    assertNoLeak(massAssignedStudent.body, forbidden);
    const createdMassAssignedStudent = await prisma.student.findFirst({ where: { name: "Mass Assigned Student" } });
    assert.equal(createdMassAssignedStudent, null, "mass-assigned student payload must not persist");

    const teacherSettingsEscalation = await requestJson(baseUrl, "/api/settings/users", {
      method: "POST",
      headers: { Authorization: `Bearer ${seeded.teacherToken}` },
      body: JSON.stringify({
        name: "Teacher Elevated Admin",
        email: `teacher-elevated-${runId}@example.test`,
        password: "Teacher-Elevated-123!",
        role: "ADMIN"
      })
    });
    assert.equal(teacherSettingsEscalation.response.status, 403, teacherSettingsEscalation.text);
    assertNoLeak(teacherSettingsEscalation.body, forbidden);
    const teacherElevated = await prisma.user.findFirst({ where: { email: `teacher-elevated-${runId}@example.test` } });
    assert.equal(teacherElevated, null, "teacher must not create elevated settings users");

    const teacherGradeSchemeEscalation = await requestJson(baseUrl, "/api/students/grade-schemes", {
      method: "POST",
      headers: { Authorization: `Bearer ${seeded.teacherToken}` },
      body: JSON.stringify({
        classId: seeded.classAId,
        subjectId: seeded.subjectBId,
        certificateType: "TERM1_FINAL",
        title: "Unauthorized scheme",
        maxScore: 100,
        sections: [{ id: "exam", name: "Exam", percentage: 100, outOf: 100 }]
      })
    });
    assert.equal(teacherGradeSchemeEscalation.response.status, 403, teacherGradeSchemeEscalation.text);
    assertNoLeak(teacherGradeSchemeEscalation.body, forbidden);
    const unauthorizedScheme = await prisma.studentGradeScheme.findFirst({
      where: { schoolId: seeded.schoolAId, classId: seeded.classAId, subjectId: seeded.subjectBId }
    });
    assert.equal(unauthorizedScheme, null, "teacher must not create grade schemes for unassigned subjects");

    const studentAdminRead = await requestJson(baseUrl, "/api/audit-logs?limit=5", {
      headers: { Authorization: `Bearer ${seeded.studentToken}` }
    });
    assert.equal(studentAdminRead.response.status, 403, studentAdminRead.text);
    assertNoLeak(studentAdminRead.body, forbidden);

    const crossTenantQuery = await requestJson(baseUrl, `/api/students?classId=${encodeURIComponent(seeded.classBId)}`, {
      headers: { Authorization: `Bearer ${seeded.managerToken}` }
    });
    assert.equal(crossTenantQuery.response.status, 200, crossTenantQuery.text);
    assertNoLeak(crossTenantQuery.body, forbidden);

    const malformedStudent = await requestJson(baseUrl, "/api/students", {
      method: "POST",
      headers: { Authorization: `Bearer ${seeded.managerToken}` },
      body: JSON.stringify({ name: "", classId: "", role: "ADMIN" })
    });
    assert.equal(malformedStudent.response.status, 400, malformedStudent.text);
    assertNoLeak(malformedStudent.body, forbidden);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    await cleanupNegativeApi(runId);
    restoreEnv();
  }
});
