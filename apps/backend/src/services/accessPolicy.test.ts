import test from "node:test";
import assert from "node:assert/strict";
import { canRole, permissionsForRole } from "./accessPolicy";

test("admin has full management permissions", () => {
  assert.equal(canRole("ADMIN", "manageLicense"), true);
  assert.equal(canRole("ADMIN", "manageSettings"), true);
  assert.equal(canRole("ADMIN", "manageTeachers"), true);
  assert.equal(canRole("ADMIN", "manageSchedules"), true);
  assert.equal(canRole("ADMIN", "manageLessons"), true);
});

test("manager can manage school operations but not license", () => {
  assert.deepEqual(permissionsForRole("MANAGER"), [
    "read",
    "manageTeachers",
    "manageSchedules",
    "manageSettings",
    "manageLessons"
  ]);
  assert.equal(canRole("MANAGER", "manageLicense"), false);
});

test("scheduler can manage schedules but not license", () => {
  assert.equal(canRole("SCHEDULER", "manageSchedules"), true);
  assert.equal(canRole("SCHEDULER", "manageLicense"), false);
  assert.deepEqual(permissionsForRole("SCHEDULER"), ["read", "manageSchedules"]);
});

test("teacher can manage lessons but not school administration", () => {
  assert.deepEqual(permissionsForRole("TEACHER"), ["read", "manageLessons"]);
  assert.equal(canRole("TEACHER", "manageSettings"), false);
  assert.equal(canRole("TEACHER", "manageTeachers"), false);
});
