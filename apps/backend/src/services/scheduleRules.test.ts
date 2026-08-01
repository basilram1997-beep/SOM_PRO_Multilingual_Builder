import test from "node:test";
import assert from "node:assert/strict";
import {
  classifySubstitutionCandidate,
  gradeOfClassName,
  isEventCoveredSlot,
  isTeacherBusyInPeriod,
  statusReason,
  substitutionKindWeight,
  RuleSlot,
  RuleTeacher
} from "./scheduleRules";

test("event-covered lesson does not make the teacher busy", () => {
  const slot: RuleSlot = {
    id: "slot-1",
    period: 2,
    teacherId: "teacher-a",
    classId: "class-10a",
    subjectId: "math",
    class: { name: "العاشر أ" }
  };

  const coveredSlotIds = new Set(
    isEventCoveredSlot(slot, [{ classId: "class-10a", fromPeriod: 2, toPeriod: 3 }]) ? [slot.id] : []
  );

  assert.equal(isTeacherBusyInPeriod("teacher-a", 2, [slot], coveredSlotIds), false);
});

test("normal lesson makes the teacher busy", () => {
  const slot: RuleSlot = {
    id: "slot-1",
    period: 2,
    teacherId: "teacher-a",
    classId: "class-10a",
    subjectId: "math",
    class: { name: "العاشر أ" }
  };

  assert.equal(isTeacherBusyInPeriod("teacher-a", 2, [slot], new Set()), true);
});

test("substitution priority prefers same class, then grade, then subject, then free", () => {
  const slot: RuleSlot = {
    id: "slot-1",
    period: 1,
    teacherId: "absent",
    classId: "class-10a",
    subjectId: "math",
    class: { name: "العاشر أ" }
  };

  const sameClass: RuleTeacher = {
    id: "same-class",
    assignments: [{ classId: "class-10a", subjectId: "english", class: { name: "العاشر أ" } }]
  };
  const sameGrade: RuleTeacher = {
    id: "same-grade",
    assignments: [{ classId: "class-10b", subjectId: "science", class: { name: "العاشر ب" } }]
  };
  const sameSubject: RuleTeacher = {
    id: "same-subject",
    assignments: [{ classId: "class-11a", subjectId: "math", class: { name: "الحادي عشر أ" } }]
  };
  const freeOnly: RuleTeacher = {
    id: "free",
    assignments: [{ classId: "class-12a", subjectId: "history", class: { name: "الثاني عشر أ" } }]
  };

  const ordered = [sameSubject, freeOnly, sameGrade, sameClass]
    .map((teacher) => ({ teacher, kind: classifySubstitutionCandidate(teacher, slot) }))
    .sort((a, b) => substitutionKindWeight[a.kind] - substitutionKindWeight[b.kind])
    .map((item) => item.teacher.id);

  assert.deepEqual(ordered, ["same-class", "same-grade", "same-subject", "free"]);
});

test("status labels use current Arabic wording", () => {
  assert.equal(statusReason("ABSENT", 1, 7), "غياب");
  assert.equal(statusReason("UNAVAILABLE", 3, 4), "في مهمة: حصة 3 - حصة 4");
});

test("grade detection works for Arabic class names", () => {
  assert.equal(gradeOfClassName("العاشر ب"), "10");
  assert.equal(gradeOfClassName("الحادي عشر أ"), "11");
  assert.equal(gradeOfClassName("الثاني عشر أ"), "12");
});
