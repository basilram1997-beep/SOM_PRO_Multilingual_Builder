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

test("class routes reject duplicates and keep homeroom and cleanup wiring", () => {
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
  assert.match(source, /teacherLessonToday\.deleteMany\(/, "class deletion should clean lesson today rows");
  assert.match(source, /teacherHomework\.deleteMany\(/, "class deletion should clean homework rows");
  assert.match(source, /teacherExam\.deleteMany\(/, "class deletion should clean exam rows");
  assert.match(source, /studentGradeEntry\.deleteMany\(/, "class deletion should clean grade entries");
  assert.match(source, /studentGradeScheme\.deleteMany\(/, "class deletion should clean grade schemes");
  assert.match(source, /dailyEvent\.deleteMany\(/, "class deletion should clean daily events");
  assert.match(source, /substitution\.deleteMany\(/, "class deletion should clean substitutions");
  assert.match(source, /baseScheduleSlot\.deleteMany\(/, "class deletion should clean base schedule rows");
  assert.match(source, /teacherAssignment\.deleteMany\(/, "class deletion should clean teacher assignments");
  assert.match(source, /homeroomAssignment\.deleteMany\(/, "class deletion should clean homeroom assignments");
  assert.match(source, /CLASS_HAS_STUDENTS/, "class deletion should refuse to delete classes that still have students");
  assert.doesNotMatch(source, /student\.deleteMany\(\{ where: \{ schoolId, classId \} \}\)/, "class deletion must not delete student files");
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
