import test from "node:test";
import assert from "node:assert/strict";
import { localizeTeacherName } from "../../i18n/displayNames.ts";
import { effectiveLoad, normalizeTeacherForm, releaseHoursUsed } from "./teacherHelpers.ts";

test("teacher helpers keep effective load and release hours consistent", () => {
  assert.equal(effectiveLoad({ targetLoad: 25, releaseHours: 3 }), 22);
  assert.equal(effectiveLoad({ targetLoad: 10, releaseHours: 12 }), 0);
  assert.equal(releaseHoursUsed({ adminRole: "", releaseHours: 5 }), 0);
  assert.equal(releaseHoursUsed({ adminRole: "مدير", releaseHours: 5 }), 5);
});

test("teacher form normalization preserves work days and preferred periods while clamping release hours", () => {
  const teacher = normalizeTeacherForm({
    name: "  أحمد  ",
    employeeNumber: "  EMP-42  ",
    adminRole: "  ",
    releaseHours: 9,
    targetLoad: 25,
    workDays: ["الخميس", "الاثنين", "الخميس"],
    preferredDays: ["الأربعاء", "الاثنين"],
    preferredClasses: ["class-b", "class-a"],
    preferredPeriods: [5, 2, 12, 2],
    employmentRatio: 80,
    notes: "  ملاحظات  "
  });

  assert.equal(teacher.name, "أحمد");
  assert.equal(teacher.employeeNumber, "EMP-42");
  assert.deepEqual(teacher.workDays, ["الخميس", "الاثنين", "الخميس"]);
  assert.deepEqual(teacher.preferredDays, ["الأربعاء", "الاثنين"]);
  assert.deepEqual(teacher.preferredPeriods, [2, 2, 5, 12]);
  assert.equal(teacher.releaseHours, 0);
  assert.equal(teacher.notes, "ملاحظات");
});

test("teacher names localize cleanly for table and report views", () => {
  assert.equal(localizeTeacherName("أحمد", "en"), "Ahmad");
  assert.equal(localizeTeacherName("عبد", "he"), "עבד");
});
