import test from "node:test";
import assert from "node:assert/strict";
import { canAccessPage, fallbackPageForRole } from "./pageAccess.ts";

test("scheduler can only access schedule operation pages", () => {
  assert.equal(canAccessPage("SCHEDULER", "daily"), true);
  assert.equal(canAccessPage("SCHEDULER", "homeroom"), true);
  assert.equal(canAccessPage("SCHEDULER", "duties"), true);
  assert.equal(canAccessPage("SCHEDULER", "teachers"), false);
  assert.equal(canAccessPage("SCHEDULER", "license"), false);
});

test("teacher is limited to teacher work pages", () => {
  assert.equal(canAccessPage("TEACHER", "teacherPortal"), true);
  assert.equal(canAccessPage("TEACHER", "homeroomPortal"), true);
  assert.equal(canAccessPage("TEACHER", "studentLessonToday"), true);
  assert.equal(canAccessPage("TEACHER", "studentCertificates"), false);
  assert.equal(canAccessPage("TEACHER", "dashboard"), false);
  assert.equal(canAccessPage("TEACHER", "users"), false);
  assert.equal(canAccessPage("TEACHER", "settings"), false);
  assert.equal(canAccessPage("TEACHER", "securityMonitoring"), false);
  assert.equal(fallbackPageForRole("TEACHER"), "homeroomPortal");
});

test("manager can access school administration pages but not developer tools or license", () => {
  assert.equal(canAccessPage("MANAGER", "reports"), true);
  assert.equal(canAccessPage("MANAGER", "settings"), true);
  assert.equal(canAccessPage("MANAGER", "operations"), false);
  assert.equal(canAccessPage("MANAGER", "securityMonitoring"), false);
  assert.equal(canAccessPage("MANAGER", "license"), false);
  assert.equal(canAccessPage("MANAGER", "users"), false);
});

test("scheduler cannot view grades without explicit permission", () => {
  assert.equal(canAccessPage("SCHEDULER", "studentMarks"), false);
  assert.equal(canAccessPage("SCHEDULER", "studentCertificates"), false);
});
