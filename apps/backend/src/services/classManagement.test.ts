import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compareSchoolClasses, sortSchoolClasses } from "@som/shared";
import { classHasCapacity, classRemainingSeats } from "./classCapacity";

test("school classes sort by grade, then section, then display name", () => {
  const classes = sortSchoolClasses([
    { id: "11a", name: "الحادي عشر أ" },
    { id: "10b", name: "العاشر ب" },
    { id: "1a", name: "الأول أ" },
    { id: "10a", name: "العاشر أ" }
  ]);

  assert.deepEqual(
    classes.map((item) => item.name),
    ["الأول أ", "العاشر أ", "العاشر ب", "الحادي عشر أ"]
  );
  assert.equal(compareSchoolClasses({ name: "العاشر أ" }, { name: "الحادي عشر أ" }) < 0, true);
  assert.equal(compareSchoolClasses({ name: "العاشر أ" }, { name: "العاشر ب" }) < 0, true);
});

test("class routes reject duplicates and keep homeroom and soft-delete wiring", () => {
  const source = readFileSync("src/modules/classes/classes.routes.ts", "utf8");

  assert.match(source, /sortSchoolClasses\(classes\)/, "class list should be sorted with the shared order helper");
  assert.match(source, /buildClassDuplicateWhere\(/, "class routes should check duplicate class names before saving");
  assert.match(source, /CLASS_ALREADY_EXISTS/, "class duplicate conflicts should be explicit");
  assert.match(source, /maxStudents/, "class routes should persist the maximum student limit");
  assert.match(
    source,
    /classesRouter\.post\("\/:id\/assign-homeroom-teacher"/,
    "homeroom assignment route should stay exposed"
  );
  assert.match(
    source,
    /applyHomeroomsToBaseScheduleFromRules\(schoolId, \{ overwriteConflicts: false, classIds: \[classId\] \}\)/,
    "class updates should refresh homeroom-derived schedule rows"
  );
  assert.match(source, /status: "INACTIVE"/, "class deletion should soft-disable the class");
  assert.match(source, /CLASS_SOFT_DELETE/, "class deletion should record a soft-delete audit event");
  assert.doesNotMatch(source, /teacherLessonToday\.deleteMany\(/, "class deletion must preserve lesson today rows");
  assert.doesNotMatch(source, /teacherHomework\.deleteMany\(/, "class deletion must preserve homework rows");
  assert.doesNotMatch(source, /teacherExam\.deleteMany\(/, "class deletion must preserve exam rows");
  assert.doesNotMatch(source, /studentGradeEntry\.deleteMany\(/, "class deletion must preserve grade entries");
  assert.doesNotMatch(source, /studentGradeScheme\.deleteMany\(/, "class deletion must preserve grade schemes");
  assert.doesNotMatch(source, /dailyEvent\.deleteMany\(/, "class deletion must preserve daily events");
  assert.doesNotMatch(source, /substitution\.deleteMany\(/, "class deletion must preserve substitutions");
  assert.doesNotMatch(source, /baseScheduleSlot\.deleteMany\(/, "class deletion must preserve base schedule rows");
  assert.doesNotMatch(source, /teacherAssignment\.deleteMany\(/, "class deletion must preserve teacher assignments");
  assert.doesNotMatch(source, /homeroomAssignment\.deleteMany\(/, "class deletion must preserve homeroom assignments");
  assert.doesNotMatch(source, /schoolClass\.delete\(/, "class deletion must not hard-delete class rows");
  assert.doesNotMatch(
    source,
    /student\.deleteMany\(\{ where: \{ schoolId, classId \} \}\)/,
    "class deletion must not delete student files"
  );
  assert.match(source, /P2003/, "class deletion should still guard relational conflicts");
});

test("class capacity helper respects unlimited and bounded class sizes", () => {
  assert.equal(classHasCapacity(null, 40), true);
  assert.equal(classHasCapacity(undefined, 40), true);
  assert.equal(classHasCapacity(30, 29), true);
  assert.equal(classHasCapacity(30, 30), false);
  assert.equal(classRemainingSeats(null, 40), null);
  assert.equal(classRemainingSeats(30, 29), 1);
  assert.equal(classRemainingSeats(30, 30), 0);
});
