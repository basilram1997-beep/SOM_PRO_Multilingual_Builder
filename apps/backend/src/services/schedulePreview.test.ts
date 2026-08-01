import test from "node:test";
import assert from "node:assert/strict";
import { previewBaseScheduleDayCopyFromRules } from "./scheduleEditing";
import {
  validateBaseScheduleConflictRows,
  type BaseScheduleConflictAssignment,
  type BaseScheduleConflictSlot
} from "./scheduleBuilder";

function slot(input: {
  id: string;
  day: string;
  period: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacherName: string;
  className: string;
  subjectName: string;
}): BaseScheduleConflictSlot {
  return {
    id: input.id,
    day: input.day,
    period: input.period,
    teacherId: input.teacherId,
    classId: input.classId,
    subjectId: input.subjectId,
    room: null,
    teacher: {
      name: input.teacherName,
      workDays: ["Monday"],
      preferredPeriods: [1, 2, 3, 4, 5, 6, 7],
      targetLoad: 4,
      releaseHours: 0
    },
    class: { name: input.className },
    subject: { name: input.subjectName }
  };
}

function assignment(input: {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  teacherName: string;
  className: string;
  subjectName: string;
}): BaseScheduleConflictAssignment {
  return {
    schoolId: input.schoolId,
    teacherId: input.teacherId,
    classId: input.classId,
    subjectId: input.subjectId,
    weeklyPeriods: 1,
    teacher: {
      name: input.teacherName,
      workDays: ["Monday"],
      preferredPeriods: [1, 2, 3, 4, 5, 6, 7],
      targetLoad: 4,
      releaseHours: 0
    },
    class: { name: input.className },
    subject: { name: input.subjectName }
  };
}

test("base schedule preview flags a teacher conflict after a hypothetical swap", () => {
  const schoolId = "school-1";
  const settings = { workingDays: ["Monday"], periodsPerDay: 7 };
  const swappedSlots = [
    slot({
      id: "slot-a",
      day: "Monday",
      period: 3,
      teacherId: "teacher-a",
      classId: "class-a",
      subjectId: "subject-a",
      teacherName: "Teacher A",
      className: "Class A",
      subjectName: "Math"
    }),
    slot({
      id: "slot-b",
      day: "Monday",
      period: 1,
      teacherId: "teacher-b",
      classId: "class-a",
      subjectId: "subject-b",
      teacherName: "Teacher B",
      className: "Class A",
      subjectName: "Science"
    }),
    slot({
      id: "slot-c",
      day: "Monday",
      period: 3,
      teacherId: "teacher-a",
      classId: "class-b",
      subjectId: "subject-c",
      teacherName: "Teacher A",
      className: "Class B",
      subjectName: "Arabic"
    })
  ];

  const conflicts = validateBaseScheduleConflictRows({
    schoolId,
    settings,
    slots: swappedSlots,
    assignments: [
      assignment({
        schoolId,
        teacherId: "teacher-a",
        classId: "class-a",
        subjectId: "subject-a",
        teacherName: "Teacher A",
        className: "Class A",
        subjectName: "Math"
      }),
      assignment({
        schoolId,
        teacherId: "teacher-b",
        classId: "class-a",
        subjectId: "subject-b",
        teacherName: "Teacher B",
        className: "Class A",
        subjectName: "Science"
      }),
      assignment({
        schoolId,
        teacherId: "teacher-a",
        classId: "class-b",
        subjectId: "subject-c",
        teacherName: "Teacher A",
        className: "Class B",
        subjectName: "Arabic"
      })
    ]
  });

  assert.ok(conflicts.length > 0, "swap preview should surface conflicts");
});

test("base schedule copy preview blocks copying into an occupied day when overwrite is disabled", async () => {
  const schoolId = "school-1";
  const settings = {
    schoolId,
    workingDays: ["Monday", "Tuesday"],
    offDays: ["Friday"],
    periodsPerDay: 7,
    maxTeachers: 100,
    adminMfaRequired: false
  };

  const sourceSlots = [
    slot({
      id: "slot-a",
      day: "Monday",
      period: 1,
      teacherId: "teacher-a",
      classId: "class-a",
      subjectId: "subject-a",
      teacherName: "Teacher A",
      className: "Class A",
      subjectName: "Math"
    })
  ];

  const targetSlots = [
    slot({
      id: "slot-b",
      day: "Tuesday",
      period: 2,
      teacherId: "teacher-b",
      classId: "class-b",
      subjectId: "subject-b",
      teacherName: "Teacher B",
      className: "Class B",
      subjectName: "Science"
    })
  ];

  const db = {
    schoolSettings: {
      findUnique: async ({ where }: { where: { schoolId: string } }) => (where.schoolId === schoolId ? settings : null),
      create: async () => settings,
      findUniqueOrThrow: async ({ where }: { where: { schoolId: string } }) => {
        if (where.schoolId !== schoolId) throw new Error("missing settings");
        return settings;
      }
    },
    periodDefinition: {
      findUnique: async () => ({ id: "period-1" }),
      update: async () => null,
      create: async () => null,
      updateMany: async () => null
    },
    baseScheduleSlot: {
      findMany: async ({ where }: { where: { day?: string } }) => {
        if (where.day === "Monday") return sourceSlots;
        if (where.day === "Tuesday") return targetSlots;
        return [];
      }
    },
    teacherAssignment: {
      findMany: async () => [
        assignment({
          schoolId,
          teacherId: "teacher-a",
          classId: "class-a",
          subjectId: "subject-a",
          teacherName: "Teacher A",
          className: "Class A",
          subjectName: "Math"
        })
      ]
    }
  } as any;

  const result = await previewBaseScheduleDayCopyFromRules(
    schoolId,
    { fromDay: "Monday", toDay: "Tuesday", overwriteConflicts: false },
    db
  );
  const previewData = result.data;
  if (!previewData) {
    throw new Error("copy preview should return data");
  }
  assert.equal(previewData.canCopy, false);
  assert.equal(previewData.ok, false);
  assert.equal(previewData.copiedCount, 0);
  assert.ok(previewData.conflicts.length > 0, "copy preview should surface conflicts for occupied target days");
});
