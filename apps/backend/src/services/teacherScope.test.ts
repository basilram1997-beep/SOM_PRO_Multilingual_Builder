import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TeacherSchema } from "@som/shared";
import { buildTeacherDuplicateWhere } from "./teacherIdentity";
import { teacherCanAccessAssignment, teacherCanAccessClass, teacherCanAccessSubject } from "./teacherScope";

test("teacher scope helpers allow matching class, subject, and assignment ids", () => {
  const scope = {
    id: "teacher-1",
    classIds: ["class-a", "class-b"],
    subjectIds: ["subject-a", "subject-b"],
    assignments: [
      { classId: "class-a", subjectId: "subject-a" },
      { classId: "class-b", subjectId: "subject-b" }
    ]
  };

  assert.equal(teacherCanAccessClass(scope, "class-a"), true);
  assert.equal(teacherCanAccessClass(scope, "class-c"), false);
  assert.equal(teacherCanAccessSubject(scope, "subject-b"), true);
  assert.equal(teacherCanAccessSubject(scope, "subject-c"), false);
  assert.equal(teacherCanAccessAssignment(scope, "class-b", "subject-b"), true);
  assert.equal(teacherCanAccessAssignment(scope, "class-a", "subject-b"), false);
});

test("teacher schema accepts work days, preferred periods, and optional employee number", () => {
  const teacher = TeacherSchema.parse({
    name: "أحمد",
    nationalId: "318500001",
    employeeNumber: "EMP-42",
    specialty: "رياضيات",
    adminRole: "مدير",
    employmentRatio: 80,
    workDays: ["الاثنين", "الثلاثاء"],
    preferredDays: ["الأربعاء"],
    preferredClasses: ["class-a"],
    preferredPeriods: [1, 3, 5],
    releaseHours: 4,
    targetLoad: 24,
    notes: "معلّم اختبار"
  });

  assert.equal(teacher.name, "أحمد");
  assert.deepEqual(teacher.workDays, ["الاثنين", "الثلاثاء"]);
  assert.deepEqual(teacher.preferredPeriods, [1, 3, 5]);
  assert.equal(teacher.releaseHours, 4);
  assert.equal(teacher.targetLoad, 24);
  assert.doesNotThrow(() =>
    TeacherSchema.parse({ name: "أحمد", nationalId: "318500001", employeeNumber: "EMP-42", classId: "class-a" })
  );
});

test("teacher duplicate filters stay school-scoped and can ignore the current record on edit", () => {
  const where = buildTeacherDuplicateWhere(
    "school-a",
    {
      nationalId: "318500001",
      employeeNumber: "EMP-42"
    },
    "teacher-a"
  );

  assert.equal(where?.schoolId, "school-a");
  assert.deepEqual(where?.id, { not: "teacher-a" });
  assert.equal(where?.OR?.length, 2);
  assert.deepEqual(where?.OR?.[0], { nationalId: "318500001" });
  assert.deepEqual(where?.OR?.[1], { employeeNumber: "EMP-42" });
});

test("teacher duplicate filters return null when no identity fields are present", () => {
  const where = buildTeacherDuplicateWhere("school-a", {});
  assert.equal(where, null);
});

test("teacher routes keep duplicate checks and destructive cleanup in place", () => {
  const source = readFileSync("src/modules/teachers/teachers.routes.ts", "utf8");

  assert.match(source, /buildTeacherDuplicateWhere\(/, "teacher routes should check identity duplicates");
  assert.match(source, /TEACHER_IDENTITY_CONFLICT/, "teacher identity conflicts should be reported explicitly");
  assert.match(source, /teacherAssignment\.deleteMany\(/, "teacher delete should still clear assignments");
  assert.match(source, /baseScheduleSlot\.deleteMany\(/, "teacher delete should still clear base schedule slots");
  assert.match(source, /dailyTeacherStatus\.deleteMany\(/, "teacher delete should still clear daily statuses");
  assert.match(source, /substitution\.deleteMany\(/, "teacher delete should still clear substitutions");
  assert.match(source, /P2003/, "teacher delete should still guard relational conflicts");
});
