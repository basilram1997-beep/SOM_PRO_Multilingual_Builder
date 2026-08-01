import test from "node:test";
import assert from "node:assert/strict";
import {
  decideHomeroomApplyAction,
  effectiveTeacherLoad,
  validateBaseScheduleRules,
  BaseRuleSlot
} from "./baseScheduleRules";

const teacher = { id: "t1", name: "أحمد", targetLoad: 2, releaseHours: 1 };
const baseSlot: BaseRuleSlot = {
  id: "s1",
  day: "الاثنين",
  period: 1,
  teacherId: "t1",
  classId: "c1",
  subjectId: "math",
  teacher,
  class: { name: "العاشر أ" },
  subject: { name: "رياضيات" }
};

test("effective teacher load subtracts release hours", () => {
  assert.equal(effectiveTeacherLoad({ targetLoad: 25, releaseHours: 3 }), 22);
});

test("base schedule detects teacher conflict in the same period", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [baseSlot, { ...baseSlot, id: "s2", classId: "c2", class: { name: "العاشر ب" } }],
    assignments: [
      { teacherId: "t1", classId: "c1", subjectId: "math" },
      { teacherId: "t1", classId: "c2", subjectId: "math" }
    ]
  });

  assert.ok(conflicts.some((item) => item.includes("تعارض معلم")));
});

test("base schedule detects class conflict in the same period across different teachers", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [
      baseSlot,
      {
        ...baseSlot,
        id: "s2",
        teacherId: "t2",
        teacher: { id: "t2", name: "سارة", targetLoad: 2, releaseHours: 0 },
        class: { name: "العاشر أ" }
      }
    ],
    assignments: [
      { teacherId: "t1", classId: "c1", subjectId: "math" },
      { teacherId: "t2", classId: "c1", subjectId: "math" }
    ]
  });

  assert.ok(conflicts.some((item) => item.includes("تعارض صف")));
});

test("base schedule detects teacher teaching a non-assigned class subject", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [baseSlot],
    assignments: []
  });

  assert.ok(conflicts.some((item) => item.includes("تكليف غير صحيح")));
});

test("base schedule detects load beyond effective target", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [baseSlot, { ...baseSlot, id: "s2", period: 2 }],
    assignments: [{ teacherId: "t1", classId: "c1", subjectId: "math" }]
  });

  assert.ok(conflicts.some((item) => item.includes("نصاب المعلم")));
});

test("base schedule detects weekly periods mismatch from teacher file", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [baseSlot],
    assignments: [{ teacherId: "t1", classId: "c1", subjectId: "math", weeklyPeriods: 2 }]
  });

  assert.ok(conflicts.some((item) => item.includes("عدد حصص") && item.includes("المطلوب 2")));
});

test("base schedule detects teacher availability outside working days and preferred periods", () => {
  const conflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين", "الثلاثاء"],
    periodsPerDay: 7,
    slots: [
      {
        ...baseSlot,
        day: "الثلاثاء",
        period: 4,
        teacher: { ...teacher, workDays: ["الاثنين"], preferredPeriods: [1, 2] }
      }
    ],
    assignments: [{ teacherId: "t1", classId: "c1", subjectId: "math", weeklyPeriods: 1 }]
  });

  assert.ok(conflicts.some((item) => item.includes("غير متاح")));
});

test("base schedule respects different weekly period targets for multiple classes", () => {
  const classASlot1 = { ...baseSlot, id: "a1", classId: "class-a", class: { name: "السابع أ" }, period: 1 };
  const classASlot2 = { ...baseSlot, id: "a2", classId: "class-a", class: { name: "السابع أ" }, period: 2 };
  const classBSlot1 = { ...baseSlot, id: "b1", classId: "class-b", class: { name: "السابع ب" }, period: 3 };

  const validConflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [classASlot1, classASlot2, classBSlot1],
    assignments: [
      { teacherId: "t1", classId: "class-a", subjectId: "math", weeklyPeriods: 2 },
      { teacherId: "t1", classId: "class-b", subjectId: "math", weeklyPeriods: 1 }
    ]
  });

  assert.equal(
    validConflicts.some((item) => item.includes("لا يطابق ملف المعلم")),
    false
  );

  const invalidConflicts = validateBaseScheduleRules({
    workingDays: ["الاثنين"],
    periodsPerDay: 7,
    slots: [classASlot1, classASlot2, classBSlot1, { ...classBSlot1, id: "b2", period: 4 }],
    assignments: [
      { teacherId: "t1", classId: "class-a", subjectId: "math", weeklyPeriods: 2 },
      { teacherId: "t1", classId: "class-b", subjectId: "math", weeklyPeriods: 1 }
    ]
  });

  assert.ok(
    invalidConflicts.some(
      (item) => item.includes("السابع ب") && item.includes("المطلوب 1") && item.includes("الموجود 2")
    )
  );
});

test("homeroom priority chooses correct action", () => {
  assert.equal(
    decideHomeroomApplyAction({
      teacherId: "t1",
      classId: "c1",
      day: "الاثنين",
      period: 1,
      overwriteConflicts: false,
      teacherBusySlot: { id: "busy", className: "العاشر ب" }
    }),
    "CONFLICT_TEACHER_BUSY"
  );
  assert.equal(
    decideHomeroomApplyAction({
      teacherId: "t1",
      classId: "c1",
      day: "الاثنين",
      period: 1,
      overwriteConflicts: true,
      teacherBusySlot: { id: "busy", className: "العاشر ب" }
    }),
    "REPLACE_TEACHER_BUSY_SLOT"
  );
  assert.equal(
    decideHomeroomApplyAction({
      teacherId: "t1",
      classId: "c1",
      day: "الاثنين",
      period: 1,
      overwriteConflicts: true,
      existingClassSlot: { id: "slot" }
    }),
    "UPDATE_CLASS_SLOT"
  );
});
