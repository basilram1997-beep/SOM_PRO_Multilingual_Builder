import test from "node:test";
import assert from "node:assert/strict";
import { buildStudentDuplicateWhere, buildStudentImportDuplicateWhere } from "./studentIdentity";
import { buildClassDuplicateWhere } from "./classIdentity";
import { canRole, permissionsForRole } from "./accessPolicy";
import { classHasCapacity, classRemainingSeats } from "./classCapacity";
import { evaluateLicensePolicy } from "./licensePolicy";
import {
  getDeviceFingerprint,
  getLicenseCredentialHashForStorage,
  shouldUseCentralLicenseServer
} from "./licenseService";
import { effectiveTeacherLoad } from "./baseScheduleRules";
import { gradeOfClassName, isEventCoveredSlot, repairDisplayText } from "./scheduleRules";
import { teacherCanAccessAssignment, teacherCanAccessClass, teacherCanAccessSubject } from "./teacherScope";
import { normalizeLoginIdentifier } from "./authService";
import { buildTeacherDuplicateWhere } from "./teacherIdentity";
import { examTimeOverlaps, findExamConflicts } from "./examSchedule";
import { exportSecurityEventsAsJsonl, mapAuditLogToSecurityEvent } from "./securityEventExport";

test("access policy returns defensive permission copies for every role", () => {
  const roles = ["ADMIN", "MANAGER", "SCHEDULER", "TEACHER", "STUDENT", "PARENT"] as const;

  for (const role of roles) {
    const permissions = permissionsForRole(role);
    assert.equal(permissions.includes("read"), true);
    const before = permissionsForRole(role);
    permissions.push("manageLicense" as never);
    assert.deepEqual(permissionsForRole(role), before);
    assert.equal(canRole(role, "read"), true);
  }
});

test("base schedule load clamps at zero when release exceeds the target", () => {
  assert.equal(effectiveTeacherLoad({ targetLoad: 1, releaseHours: 5 }), 0);
  assert.equal(effectiveTeacherLoad({ targetLoad: 0, releaseHours: 0 }), 0);
});

test("schedule helpers keep plain text stable and detect Arabic grade names", () => {
  assert.equal(repairDisplayText("plain text"), "plain text");
  assert.equal(gradeOfClassName("الصف التاسع أ"), "9");
  assert.equal(gradeOfClassName("الصف الثامن أ"), "");
});

test("event coverage accepts global and class-scoped periods", () => {
  const slot = {
    id: "slot-1",
    period: 3,
    teacherId: "teacher-1",
    classId: "class-1",
    subjectId: "subject-1",
    class: { name: "الصف العاشر أ" }
  };

  assert.equal(isEventCoveredSlot(slot, [{ classId: null, fromPeriod: 2, toPeriod: 4 }]), true);
  assert.equal(isEventCoveredSlot(slot, [{ classId: "class-1", fromPeriod: 3, toPeriod: 3 }]), true);
  assert.equal(isEventCoveredSlot(slot, [{ classId: "other", fromPeriod: 3, toPeriod: 3 }]), false);
});

test("teacher scope helpers allow unrestricted access when no scope exists", () => {
  assert.equal(teacherCanAccessClass(null, "class-a"), true);
  assert.equal(teacherCanAccessSubject(null, "subject-a"), true);
  assert.equal(teacherCanAccessAssignment(null, "class-a", "subject-a"), true);

  const scope = {
    id: "teacher-1",
    classIds: ["class-a"],
    subjectIds: ["subject-a"],
    assignments: [{ classId: "class-a", subjectId: "subject-a" }]
  };

  assert.equal(teacherCanAccessClass(scope, "class-a"), true);
  assert.equal(teacherCanAccessSubject(scope, "subject-a"), true);
  assert.equal(teacherCanAccessAssignment(scope, "class-a", "subject-a"), true);
  assert.equal(teacherCanAccessAssignment(scope, "class-a", "subject-b"), false);
});

test("license policy handles forced locks and grace expiry deterministically", () => {
  const forced = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-01T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a",
    forceLock: true
  });

  assert.equal(forced.status, "SUSPENDED");
  assert.equal(forced.readOnly, true);
  assert.equal(forced.readOnlyReason, "تم إيقاف الترخيص من مالك البرنامج");

  const graceExpired = evaluateLicensePolicy({
    status: "ACTIVE",
    expiresAt: new Date("2027-01-01T00:00:00Z"),
    now: new Date("2026-02-10T00:00:00Z"),
    deviceFingerprint: "device-a",
    currentDeviceFingerprint: "device-a",
    centralUnavailable: true,
    lastSuccessfulCheckAt: new Date("2026-02-01T00:00:00Z"),
    gracePeriodDays: 3
  });

  assert.equal(graceExpired.status, "SUSPENDED");
  assert.equal(graceExpired.readOnly, true);
});

test("license helpers normalize device and short code identity consistently", () => {
  assert.equal(shouldUseCentralLicenseServer("  SAAS  ", false), true);
  assert.equal(shouldUseCentralLicenseServer("development", true), true);
  assert.equal(getDeviceFingerprint({ deviceId: "  device-1  " }), "device-1");

  const normalizedA = getLicenseCredentialHashForStorage("somabcd ef23-gh45");
  const normalizedB = getLicenseCredentialHashForStorage("SOM-ABCD-EF23-GH45");
  assert.equal(normalizedA, normalizedB);
});

test("student identity helpers trim whitespace and ignore blank import fields", () => {
  const duplicateWhere = buildStudentDuplicateWhere("school-a", "class-a", {
    name: "  Alice  ",
    nationalId: "   ",
    fatherName: "  Bob  ",
    motherName: "",
    fatherPhone: " 0500 ",
    studentPhone: "   "
  });

  assert.equal(duplicateWhere.schoolId, "school-a");
  assert.equal(duplicateWhere.classId, "class-a");
  assert.equal(duplicateWhere.OR?.length, 1);
  assert.deepEqual(duplicateWhere.OR?.[0], {
    name: "Alice",
    fatherName: "Bob",
    fatherPhone: "0500"
  });

  const importWhere = buildStudentImportDuplicateWhere("school-a", {
    name: "   ",
    nationalId: "   ",
    fatherName: "   "
  });

  assert.equal(importWhere.schoolId, "school-a");
  assert.equal(importWhere.OR?.length, 0);
});

test("login identifiers normalize both plain names and email-like values", () => {
  assert.equal(normalizeLoginIdentifier("  ADMIN  "), "admin@som.local");
  assert.equal(normalizeLoginIdentifier("  Admin@Example.com  "), "admin@example.com");
  assert.equal(normalizeLoginIdentifier("   "), "");
});

test("class identity helpers ignore blank names and support edit exclusions", () => {
  assert.equal(buildClassDuplicateWhere("school-a", { name: "   " }), undefined);

  const where = buildClassDuplicateWhere("school-a", { name: "  10A  " }, "class-1");
  assert.equal(where?.schoolId, "school-a");
  assert.equal(where?.name, "10A");
  assert.deepEqual(where?.id, { not: "class-1" });
});

test("teacher identity helpers trim identity fields and return null when empty", () => {
  assert.equal(buildTeacherDuplicateWhere("school-a", {}), null);

  const where = buildTeacherDuplicateWhere("school-a", { nationalId: " 123 ", employeeNumber: " EMP-1 " }, "teacher-1");

  assert.equal(where?.schoolId, "school-a");
  assert.deepEqual(where?.id, { not: "teacher-1" });
  assert.equal(where?.OR?.length, 2);
  assert.deepEqual(where?.OR?.[0], { nationalId: "123" });
  assert.deepEqual(where?.OR?.[1], { employeeNumber: "EMP-1" });
});

test("class capacity helpers handle unlimited and exhausted classes", () => {
  assert.equal(classHasCapacity(null, 99), true);
  assert.equal(classRemainingSeats(null, 99), null);
  assert.equal(classHasCapacity(30, 30), false);
  assert.equal(classHasCapacity(30, 29), true);
  assert.equal(classRemainingSeats(30, 29), 1);
  assert.equal(classRemainingSeats(30, 35), 0);
});

test("exam schedule helpers reject bad time input and isolate same-class overlaps", () => {
  assert.equal(examTimeOverlaps("08:00", "09:00", "09:00", "10:00"), false);
  assert.equal(examTimeOverlaps("08:00", "09:00", "08:30", "09:30"), true);
  assert.equal(examTimeOverlaps("bad", "09:00", "08:30", "09:30"), false);

  const entries = [
    { id: "a", classId: "class-a", date: "2026-07-10", startTime: "08:00", endTime: "09:00" },
    { id: "b", classId: "class-a", date: "2026-07-10", startTime: "08:30", endTime: "09:30" },
    { id: "c", classId: "class-b", date: "2026-07-10", startTime: "08:30", endTime: "09:30" }
  ];

  assert.deepEqual(
    findExamConflicts(entries, entries[0]).map((item) => item.id),
    ["b"]
  );
});

test("security event export maps audit rows to jsonl without dropping nulls", () => {
  const event = mapAuditLogToSecurityEvent({
    createdAt: new Date("2026-07-23T10:00:00.000Z"),
    action: "LOGIN",
    entity: "AUTH",
    schoolId: "school-a",
    userId: null,
    entityId: undefined,
    accessResult: undefined,
    path: "/api/auth/login",
    method: "POST",
    statusCode: 200,
    ipAddress: undefined,
    userAgent: "Test Agent"
  });

  assert.equal(event.timestamp, "2026-07-23T10:00:00.000Z");
  assert.equal(event.userId, null);
  assert.equal(event.entityId, null);

  const jsonl = exportSecurityEventsAsJsonl([event]);
  assert.equal(jsonl, JSON.stringify(event));
});
