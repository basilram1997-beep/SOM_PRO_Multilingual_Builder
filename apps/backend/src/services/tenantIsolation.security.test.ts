import test from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import net from "node:net";
import path from "node:path";
import { promises as fs } from "node:fs";
import { prisma } from "../db/prisma";
import { hashPassword } from "./authService";

type SeededTenant = {
  schoolId: string;
  classId: string;
  teacherId: string;
  subjectId: string;
  assignmentId: string;
  baseSlotId: string;
  dailyScheduleId: string;
  dailyEventId: string;
  studentId: string;
  userId: string;
  email: string;
  password: string;
  auditLogId: string;
  reportExportId: string;
  backupJobId: string;
};

function makeRunId() {
  return `${Date.now().toString(36)}-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
}

function useTenantIsolationRuntimeEnv() {
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

async function seedTenant(runId: string, label: "a" | "b"): Promise<SeededTenant> {
  const schoolId = `tenant-${label}-school-${runId}`;
  const classId = `tenant-${label}-class-${runId}`;
  const teacherId = `tenant-${label}-teacher-${runId}`;
  const subjectId = `tenant-${label}-subject-${runId}`;
  const assignmentId = `tenant-${label}-assignment-${runId}`;
  const baseSlotId = `tenant-${label}-base-slot-${runId}`;
  const dailyScheduleId = `tenant-${label}-daily-${runId}`;
  const dailyEventId = `tenant-${label}-event-${runId}`;
  const studentId = `tenant-${label}-student-${runId}`;
  const userId = `tenant-${label}-user-${runId}`;
  const auditLogId = `tenant-${label}-audit-${runId}`;
  const reportExportId = `tenant-${label}-report-export-${runId}`;
  const backupJobId = `tenant-${label}-backup-job-${runId}`;
  const email = `tenant-${label}-${runId}@example.com`;
  const password = `Tenant-${label.toUpperCase()}-123!`;

  await prisma.school.create({
    data: {
      id: schoolId,
      name: `Tenant ${label.toUpperCase()} School ${runId}`,
      address: "Jerusalem",
      managerName: `Tenant ${label.toUpperCase()} Manager`,
      institutionCode: `TI${label.toUpperCase()}${runId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`,
      isActive: true
    }
  });

  await prisma.schoolClass.create({
    data: {
      id: classId,
      schoolId,
      name: `Tenant ${label.toUpperCase()} Class`,
      grade: "7",
      section: label.toUpperCase()
    }
  });

  await prisma.schoolSettings.create({
    data: {
      schoolId,
      workingDays: ["Wednesday", "Thursday"],
      offDays: [],
      periodsPerDay: 7,
      maxTeachers: 100
    }
  });

  await prisma.teacher.create({
    data: {
      id: teacherId,
      schoolId,
      name: `Tenant ${label.toUpperCase()} Teacher`,
      employeeNumber: `EMP-${label}-${runId}`,
      nationalId: `TID-${label}-${runId}`,
      specialty: "Math"
    }
  });

  await prisma.subject.create({
    data: {
      id: subjectId,
      schoolId,
      name: `Tenant ${label.toUpperCase()} Subject`,
      code: `SUB-${label}-${runId}`,
      maxMark: 100,
      passMark: 50
    }
  });

  await prisma.teacherAssignment.create({
    data: {
      id: assignmentId,
      schoolId,
      teacherId,
      classId,
      subjectId,
      weeklyPeriods: 4
    }
  });

  await prisma.baseScheduleSlot.create({
    data: {
      id: baseSlotId,
      schoolId,
      day: "Wednesday",
      period: 1,
      classId,
      subjectId,
      teacherId,
      room: `Room-${label.toUpperCase()}`
    }
  });

  await prisma.student.create({
    data: {
      id: studentId,
      schoolId,
      classId,
      name: `Tenant ${label.toUpperCase()} Student`,
      firstName: `Tenant${label.toUpperCase()}`,
      lastName: "Student",
      internalStudentNumber: `ST-${label}-${runId}`,
      nationalId: `NID-${label}-${runId}`,
      guardianPhone: `050000000${label === "a" ? "1" : "2"}`
    }
  });

  await prisma.studentAttendance.create({
    data: {
      schoolId,
      studentId,
      date: "2026-08-12",
      day: "Wednesday",
      status: "PRESENT"
    }
  });

  await prisma.dailySchedule.create({
    data: {
      id: dailyScheduleId,
      schoolId,
      date: "2026-08-12",
      day: "Wednesday"
    }
  });

  await prisma.dailyEvent.create({
    data: {
      id: dailyEventId,
      schoolId,
      dailyScheduleId,
      type: "ACTIVITY",
      classId,
      fromPeriod: 2,
      toPeriod: 2,
      color: "#2563eb",
      note: `Tenant ${label.toUpperCase()} event`
    }
  });

  await prisma.user.create({
    data: {
      id: userId,
      schoolId,
      name: `Tenant ${label.toUpperCase()} Admin`,
      email,
      password: hashPassword(password),
      role: "ADMIN"
    }
  });

  await prisma.auditLog.create({
    data: {
      id: auditLogId,
      schoolId,
      userId,
      action: "TENANT_ISOLATION_SEED",
      entity: "Student",
      entityId: studentId,
      after: { marker: label, studentId, classId }
    }
  });

  await prisma.reportExport.create({
    data: {
      id: reportExportId,
      schoolId,
      reportType: "TENANT_ISOLATION_REPORT",
      fileType: "json",
      filePath: `reports/${schoolId}/tenant-${label}.json`,
      requestedBy: userId,
      status: "COMPLETED",
      expiresAt: new Date("2026-09-12T00:00:00.000Z")
    }
  });

  await prisma.backupJob.create({
    data: {
      id: backupJobId,
      schoolId,
      backupType: "TENANT_ISOLATION_BACKUP",
      status: "COMPLETED",
      filePath: `backups/${schoolId}/tenant-${label}.sql`,
      checksum: `checksum-${label}-${runId}`,
      encrypted: false,
      startedAt: new Date("2026-08-12T00:00:00.000Z"),
      finishedAt: new Date("2026-08-12T00:01:00.000Z"),
      createdBy: userId
    }
  });

  return {
    schoolId,
    classId,
    teacherId,
    subjectId,
    assignmentId,
    baseSlotId,
    dailyScheduleId,
    dailyEventId,
    studentId,
    userId,
    email,
    password,
    auditLogId,
    reportExportId,
    backupJobId
  };
}

async function cleanupTenants(schoolIds: string[]) {
  await prisma.auditLog.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.reportExport.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.backupJob.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.licenseActivation.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailyEvent.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.substitution.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailyTeacherStatus.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dailySchedule.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentAttendance.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentNotification.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentAcademicRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentBehaviorRecord.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentCertificate.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeEntry.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.studentGradeScheme.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.baseScheduleSlot.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.homeroomAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.dutyAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacherSubject.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.student.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.user.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.teacher.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.subject.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolClass.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.schoolSettings.deleteMany({ where: { schoolId: { in: schoolIds } } }).catch(() => null);
  await prisma.school.deleteMany({ where: { id: { in: schoolIds } } }).catch(() => null);
  await fs.rm(path.join(process.cwd(), "tmp", "uploads"), { recursive: true, force: true }).catch(() => null);
}

async function login(baseUrl: string, email: string, password: string) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const payload = JSON.parse(text);
  const token = String(payload?.data?.token || "");
  assert.ok(token, "login should return a bearer token");
  return token;
}

async function requestJson(baseUrl: string, token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body, text };
}

function assertNoTenantBLeak(value: unknown, tenantB: SeededTenant) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes(tenantB.schoolId), false, "response must not leak school B id");
  assert.equal(serialized.includes(tenantB.classId), false, "response must not leak class B id");
  assert.equal(serialized.includes(tenantB.teacherId), false, "response must not leak teacher B id");
  assert.equal(serialized.includes(tenantB.subjectId), false, "response must not leak subject B id");
  assert.equal(serialized.includes(tenantB.assignmentId), false, "response must not leak assignment B id");
  assert.equal(serialized.includes(tenantB.baseSlotId), false, "response must not leak base schedule B id");
  assert.equal(serialized.includes(tenantB.dailyScheduleId), false, "response must not leak daily schedule B id");
  assert.equal(serialized.includes(tenantB.dailyEventId), false, "response must not leak daily event B id");
  assert.equal(serialized.includes(tenantB.studentId), false, "response must not leak student B id");
  assert.equal(serialized.includes(tenantB.auditLogId), false, "response must not leak audit log B id");
  assert.equal(serialized.includes(tenantB.reportExportId), false, "response must not leak report export B id");
  assert.equal(serialized.includes(tenantB.backupJobId), false, "response must not leak backup job B id");
}

function withMockClamAv(fn: (url: string) => Promise<void>) {
  const server = net.createServer((socket) => {
    socket.on("data", () => null);
    socket.on("end", () => {
      if (!socket.destroyed) {
        socket.write("stream: OK\n");
        socket.end();
      }
    });
  });

  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to start mock scanner"));
        return;
      }

      try {
        await fn(`clamav://127.0.0.1:${address.port}`);
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        server.close(() => null);
      }
    });
  });
}

async function closeServer(server: Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

test("tenant isolation blocks cross-school resource access through params, query, and body identifiers", async () => {
  const restoreEnv = useTenantIsolationRuntimeEnv();
  const runId = makeRunId();
  const tenantA = await seedTenant(runId, "a");
  const tenantB = await seedTenant(runId, "b");
  let server: Server | null = null;

  try {
    const { createApp } = await import("../app");
    const app = createApp();
    server = app.listen(0);
    await new Promise<void>((resolve) => server!.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Failed to determine runtime test port");

    const baseUrl = `http://127.0.0.1:${address.port}`;
    const tokenA = await login(baseUrl, tenantA.email, tenantA.password);

    const teacherList = await requestJson(baseUrl, tokenA, "/api/teachers");
    assert.equal(teacherList.response.status, 200, teacherList.text);
    assertNoTenantBLeak(teacherList.body, tenantB);
    assert.ok(
      teacherList.body?.data?.some((teacher: { id: string }) => teacher.id === tenantA.teacherId),
      "school A teacher list should include school A teacher"
    );

    const teacherPatch = await requestJson(baseUrl, tokenA, `/api/teachers/${encodeURIComponent(tenantB.teacherId)}`, {
      method: "PATCH",
      body: JSON.stringify({ specialty: "Changed by tenant A" })
    });
    assert.equal(teacherPatch.response.status, 404, teacherPatch.text);
    assertNoTenantBLeak(teacherPatch.body, tenantB);
    const teacherB = await prisma.teacher.findUnique({ where: { id: tenantB.teacherId } });
    assert.equal(teacherB?.specialty, "Math", "school A must not mutate school B teacher");

    const teacherAssignmentPatch = await requestJson(
      baseUrl,
      tokenA,
      `/api/teachers/${encodeURIComponent(tenantB.teacherId)}/assignments/${encodeURIComponent(tenantB.assignmentId)}/weekly-periods`,
      { method: "PATCH", body: JSON.stringify({ weeklyPeriods: 9 }) }
    );
    assert.equal(teacherAssignmentPatch.response.status, 404, teacherAssignmentPatch.text);
    assertNoTenantBLeak(teacherAssignmentPatch.body, tenantB);
    const assignmentB = await prisma.teacherAssignment.findUnique({ where: { id: tenantB.assignmentId } });
    assert.equal(assignmentB?.weeklyPeriods, 4, "school A must not mutate school B teacher assignment");

    const subjectList = await requestJson(baseUrl, tokenA, "/api/subjects");
    assert.equal(subjectList.response.status, 200, subjectList.text);
    assertNoTenantBLeak(subjectList.body, tenantB);
    assert.ok(
      subjectList.body?.data?.some((subject: { id: string }) => subject.id === tenantA.subjectId),
      "school A subject list should include school A subject"
    );

    const subjectPut = await requestJson(baseUrl, tokenA, `/api/subjects/${encodeURIComponent(tenantB.subjectId)}`, {
      method: "PUT",
      body: JSON.stringify({ name: `Tenant B Subject Changed By A ${runId}` })
    });
    assert.equal(subjectPut.response.status, 404, subjectPut.text);
    assertNoTenantBLeak(subjectPut.body, tenantB);
    const subjectB = await prisma.subject.findUnique({ where: { id: tenantB.subjectId } });
    assert.equal(subjectB?.name, "Tenant B Subject", "school A must not mutate school B subject");

    const studentListByOtherClass = await requestJson(
      baseUrl,
      tokenA,
      `/api/students?classId=${encodeURIComponent(tenantB.classId)}`
    );
    assert.equal(studentListByOtherClass.response.status, 200, studentListByOtherClass.text);
    assert.deepEqual(studentListByOtherClass.body?.data, [], "school A query by school B class should return no rows");
    assertNoTenantBLeak(studentListByOtherClass.body, tenantB);

    const studentContext = await requestJson(
      baseUrl,
      tokenA,
      `/api/students/${encodeURIComponent(tenantB.studentId)}/context`
    );
    assert.equal(studentContext.response.status, 404, studentContext.text);
    assertNoTenantBLeak(studentContext.body, tenantB);

    const attendanceRead = await requestJson(
      baseUrl,
      tokenA,
      `/api/students/attendance?classId=${encodeURIComponent(tenantB.classId)}&date=2026-08-12`
    );
    assert.equal(attendanceRead.response.status, 404, attendanceRead.text);
    assertNoTenantBLeak(attendanceRead.body, tenantB);

    const attendanceWrite = await requestJson(baseUrl, tokenA, "/api/students/attendance", {
      method: "PUT",
      body: JSON.stringify({
        studentId: tenantB.studentId,
        date: "2026-08-13",
        day: "Thursday",
        status: "ABSENT_UNEXCUSED"
      })
    });
    assert.equal(attendanceWrite.response.status, 404, attendanceWrite.text);
    assertNoTenantBLeak(attendanceWrite.body, tenantB);
    const forbiddenAttendance = await prisma.studentAttendance.findUnique({
      where: {
        schoolId_studentId_date: {
          schoolId: tenantB.schoolId,
          studentId: tenantB.studentId,
          date: "2026-08-13"
        }
      }
    });
    assert.equal(forbiddenAttendance, null, "school A must not create or alter attendance for school B");

    const classPatch = await requestJson(baseUrl, tokenA, `/api/classes/${encodeURIComponent(tenantB.classId)}`, {
      method: "PATCH",
      body: JSON.stringify({ name: `Tenant B Renamed By A ${runId}` })
    });
    assert.equal(classPatch.response.status, 404, classPatch.text);
    assertNoTenantBLeak(classPatch.body, tenantB);
    const classB = await prisma.schoolClass.findUnique({ where: { id: tenantB.classId } });
    assert.equal(classB?.name, "Tenant B Class", "school A must not mutate school B class");

    const baseScheduleList = await requestJson(baseUrl, tokenA, "/api/schedules/base");
    assert.equal(baseScheduleList.response.status, 200, baseScheduleList.text);
    assertNoTenantBLeak(baseScheduleList.body, tenantB);
    assert.ok(
      baseScheduleList.body?.data?.some((slot: { id: string }) => slot.id === tenantA.baseSlotId),
      "school A base schedule should include school A slot"
    );

    const baseScheduleWriteWithTenantBIds = await requestJson(baseUrl, tokenA, "/api/schedules/base", {
      method: "POST",
      body: JSON.stringify({
        day: "Wednesday",
        period: 3,
        classId: tenantB.classId,
        subjectId: tenantB.subjectId,
        teacherId: tenantB.teacherId,
        room: "Cross-school room"
      })
    });
    assert.equal(baseScheduleWriteWithTenantBIds.response.status, 400, baseScheduleWriteWithTenantBIds.text);
    assertNoTenantBLeak(baseScheduleWriteWithTenantBIds.body, tenantB);
    const crossSchoolBaseSlot = await prisma.baseScheduleSlot.findUnique({
      where: {
        schoolId_day_period_classId: {
          schoolId: tenantA.schoolId,
          day: "Wednesday",
          period: 3,
          classId: tenantB.classId
        }
      }
    });
    assert.equal(crossSchoolBaseSlot, null, "school A must not create a base slot referencing school B resources");

    const baseScheduleSwapWithTenantBClass = await requestJson(baseUrl, tokenA, "/api/schedules/base/swap-periods", {
      method: "POST",
      body: JSON.stringify({ day: "Wednesday", classId: tenantB.classId, firstPeriod: 1, secondPeriod: 2 })
    });
    assert.equal(baseScheduleSwapWithTenantBClass.response.status, 404, baseScheduleSwapWithTenantBClass.text);
    assertNoTenantBLeak(baseScheduleSwapWithTenantBClass.body, tenantB);

    const dailyDetails = await requestJson(baseUrl, tokenA, "/api/daily/2026-08-12");
    assert.equal(dailyDetails.response.status, 200, dailyDetails.text);
    assertNoTenantBLeak(dailyDetails.body, tenantB);
    assert.equal(dailyDetails.body?.data?.id, tenantA.dailyScheduleId);

    const dailyEventWithTenantBClass = await requestJson(baseUrl, tokenA, "/api/daily/2026-08-12/events", {
      method: "POST",
      body: JSON.stringify({
        day: "Wednesday",
        type: "ACTIVITY",
        classIds: [tenantB.classId],
        fromPeriod: 3,
        toPeriod: 3,
        color: "#ef4444",
        note: "Cross-school event"
      })
    });
    assert.equal(dailyEventWithTenantBClass.response.status, 400, dailyEventWithTenantBClass.text);
    assertNoTenantBLeak(dailyEventWithTenantBClass.body, tenantB);
    const crossSchoolDailyEvent = await prisma.dailyEvent.findFirst({
      where: { schoolId: tenantA.schoolId, classId: tenantB.classId, note: "Cross-school event" }
    });
    assert.equal(crossSchoolDailyEvent, null, "school A must not create a daily event for school B class");

    const dailyEventDelete = await requestJson(
      baseUrl,
      tokenA,
      `/api/daily/events/${encodeURIComponent(tenantB.dailyEventId)}`,
      { method: "DELETE" }
    );
    assert.equal(dailyEventDelete.response.status, 404, dailyEventDelete.text);
    assertNoTenantBLeak(dailyEventDelete.body, tenantB);
    const eventB = await prisma.dailyEvent.findUnique({ where: { id: tenantB.dailyEventId } });
    assert.ok(eventB, "school A must not delete school B daily event");

    const archiveList = await requestJson(baseUrl, tokenA, "/api/archive");
    assert.equal(archiveList.response.status, 200, archiveList.text);
    assertNoTenantBLeak(archiveList.body, tenantB);
    assert.ok(
      archiveList.body?.data?.some((day: { id: string }) => day.id === tenantA.dailyScheduleId),
      "school A archive list should include school A day"
    );

    const archiveDelete = await requestJson(baseUrl, tokenA, "/api/archive/2026-08-12", { method: "DELETE" });
    assert.equal(archiveDelete.response.status, 204, archiveDelete.text);
    const dailyBAfterArchiveDelete = await prisma.dailySchedule.findUnique({ where: { id: tenantB.dailyScheduleId } });
    assert.ok(dailyBAfterArchiveDelete, "school A archive delete must not delete school B daily schedule");

    const reportAttendanceOtherClass = await requestJson(
      baseUrl,
      tokenA,
      `/api/reports/attendance?classId=${encodeURIComponent(tenantB.classId)}&from=2026-08-12&to=2026-08-12`
    );
    assert.equal(reportAttendanceOtherClass.response.status, 404, reportAttendanceOtherClass.text);
    assertNoTenantBLeak(reportAttendanceOtherClass.body, tenantB);

    const reportGradesOtherSubject = await requestJson(
      baseUrl,
      tokenA,
      `/api/reports/grades?classId=${encodeURIComponent(tenantA.classId)}&subjectId=${encodeURIComponent(tenantB.subjectId)}`
    );
    assert.equal(reportGradesOtherSubject.response.status, 404, reportGradesOtherSubject.text);
    assertNoTenantBLeak(reportGradesOtherSubject.body, tenantB);

    const schoolOperations = await requestJson(baseUrl, tokenA, "/api/schools/operations");
    assert.equal(schoolOperations.response.status, 200, schoolOperations.text);
    assertNoTenantBLeak(schoolOperations.body, tenantB);
    assert.ok(
      JSON.stringify(schoolOperations.body).includes(tenantA.reportExportId),
      "school A operations should include school A report export"
    );
    assert.ok(
      JSON.stringify(schoolOperations.body).includes(tenantA.backupJobId),
      "school A operations should include school A backup job"
    );

    const auditList = await requestJson(baseUrl, tokenA, "/api/audit-logs?limit=200");
    assert.equal(auditList.response.status, 200, auditList.text);
    assertNoTenantBLeak(auditList.body, tenantB);
    assert.ok(
      auditList.body?.data?.items?.some((item: { id: string }) => item.id === tenantA.auditLogId),
      "school A audit list should still include its own audit logs"
    );

    const auditDetail = await requestJson(baseUrl, tokenA, `/api/audit-logs/${encodeURIComponent(tenantB.auditLogId)}`);
    assert.equal(auditDetail.response.status, 404, auditDetail.text);
    assertNoTenantBLeak(auditDetail.body, tenantB);

    const schoolDashboard = await requestJson(
      baseUrl,
      tokenA,
      `/api/schools/${encodeURIComponent(tenantB.schoolId)}/dashboard`
    );
    assert.equal(schoolDashboard.response.status, 403, schoolDashboard.text);
    assertNoTenantBLeak(schoolDashboard.body, tenantB);

    const schoolExport = await requestJson(
      baseUrl,
      tokenA,
      `/api/schools/${encodeURIComponent(tenantB.schoolId)}/export-data`,
      { method: "POST", body: JSON.stringify({}) }
    );
    assert.equal(schoolExport.response.status, 403, schoolExport.text);
    assertNoTenantBLeak(schoolExport.body, tenantB);

    const schoolDelete = await requestJson(
      baseUrl,
      tokenA,
      `/api/schools/${encodeURIComponent(tenantB.schoolId)}/delete-data`,
      { method: "POST", body: JSON.stringify({ confirm: true, mode: "DELETE", reason: "tenant isolation test" }) }
    );
    assert.equal(schoolDelete.response.status, 403, schoolDelete.text);
    assertNoTenantBLeak(schoolDelete.body, tenantB);

    const schoolBAfterForbiddenLifecycleRequests = await prisma.school.findUnique({ where: { id: tenantB.schoolId } });
    assert.equal(
      schoolBAfterForbiddenLifecycleRequests?.isActive,
      true,
      "school A must not deactivate/delete school B"
    );

    const originalScannerEnabled = process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED;
    const originalScannerUrl = process.env.SOM_FILE_UPLOAD_SCANNER_URL;
    await withMockClamAv(async (scannerUrl) => {
      process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED = "true";
      process.env.SOM_FILE_UPLOAD_SCANNER_URL = scannerUrl;
      const upload = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenA}`,
          "Content-Type": "application/pdf",
          "x-file-name": `${tenantB.schoolId}-should-not-control-context.pdf`,
          "x-mime-type": "application/pdf"
        },
        body: Buffer.from("%PDF-1.4 tenant isolation upload")
      });
      const uploadText = await upload.text();
      assert.equal(upload.status, 201, uploadText);
      const uploadBody = JSON.parse(uploadText);
      assert.match(String(uploadBody?.data?.filePath || ""), new RegExp(`^uploads/${tenantA.schoolId}/`));
      assert.equal(
        String(uploadBody?.data?.filePath || "").includes(`uploads/${tenantB.schoolId}/`),
        false,
        "client-supplied file names must not move uploads into school B storage"
      );
    }).finally(() => {
      process.env.SOM_FILE_UPLOAD_SCANNING_ENABLED = originalScannerEnabled;
      process.env.SOM_FILE_UPLOAD_SCANNER_URL = originalScannerUrl;
    });
  } finally {
    if (server) await closeServer(server);
    await cleanupTenants([tenantA.schoolId, tenantB.schoolId]);
    restoreEnv();
  }
});
