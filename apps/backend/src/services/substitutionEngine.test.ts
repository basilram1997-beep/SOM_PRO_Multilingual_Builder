import test from "node:test";
import assert from "node:assert/strict";
import { generateSubstitutions } from "./substitutionEngine";

test("generateSubstitutions picks the best available substitute teacher from the data source", async () => {
  const created: Array<{ substituteTeacherId: string | null; kind: string; isManual: boolean }> = [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 2,
          teacherId: "absent-teacher",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "absent-teacher", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "best-teacher",
          name: "معلم بديل مناسب",
          assignments: [
            { classId: "class-10a", subjectId: "math", class: { name: "العاشر أ" }, subject: { name: "رياضيات" } }
          ]
        },
        {
          id: "free-teacher",
          name: "معلم فارغ",
          assignments: [
            { classId: "class-11a", subjectId: "science", class: { name: "الحادي عشر أ" }, subject: { name: "علوم" } }
          ]
        }
      ]
    },
    dailyEvent: {
      findMany: async () => []
    },
    substitution: {
      create: async ({ data }: { data: { substituteTeacherId: string | null; kind: string; isManual: boolean } }) => {
        created.push(data);
        return { ...data };
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الاثنين",
    statuses: [{ teacherId: "absent-teacher", type: "ABSENT", fromPeriod: 2, toPeriod: 2 }],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].substituteTeacherId, "best-teacher");
  assert.equal(created[0].isManual, false);
  assert.equal(result[0].substituteTeacherId, "best-teacher");
});

test("generateSubstitutions falls back when the best matching teacher is unavailable", async () => {
  const created: Array<{ substituteTeacherId: string | null; kind: string; isManual: boolean }> = [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 3,
          teacherId: "absent-teacher",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "absent-teacher", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-2",
          period: 3,
          teacherId: "busy-best",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "busy-best", name: "المعلم الأفضل لكن مشغول" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "busy-best",
          name: "المعلم الأفضل لكن مشغول",
          assignments: [
            { classId: "class-10a", subjectId: "math", class: { name: "العاشر أ" }, subject: { name: "رياضيات" } }
          ]
        },
        {
          id: "free-fallback",
          name: "معلم بديل احتياطي",
          assignments: [
            { classId: "class-11a", subjectId: "science", class: { name: "الحادي عشر أ" }, subject: { name: "علوم" } }
          ]
        }
      ]
    },
    dailyEvent: {
      findMany: async () => []
    },
    substitution: {
      create: async ({ data }: { data: { substituteTeacherId: string | null; kind: string; isManual: boolean } }) => {
        created.push(data);
        return { ...data };
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الاثنين",
    statuses: [{ teacherId: "absent-teacher", type: "ABSENT", fromPeriod: 3, toPeriod: 3 }],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].substituteTeacherId, "free-fallback");
  assert.equal(result[0].substituteTeacherId, "free-fallback");
});

test("generateSubstitutions keeps one substitute teacher from being assigned twice in the same period", async () => {
  const created: Array<{ substituteTeacherId: string | null; kind: string; isManual: boolean }> = [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 2,
          teacherId: "absent-teacher",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "absent-teacher", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-2",
          period: 2,
          teacherId: "absent-teacher",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "absent-teacher", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "teacher-b",
          name: "المعلم البديل الأول",
          assignments: [
            {
              classId: "class-10a",
              subjectId: "math",
              class: { name: "العاشر أ" },
              subject: { name: "رياضيات" }
            }
          ]
        },
        {
          id: "teacher-c",
          name: "المعلم البديل الثاني",
          assignments: [
            {
              classId: "class-10a",
              subjectId: "math",
              class: { name: "العاشر أ" },
              subject: { name: "رياضيات" }
            }
          ]
        }
      ]
    },
    dailyEvent: {
      findMany: async () => []
    },
    substitution: {
      create: async ({ data }: { data: { substituteTeacherId: string | null; kind: string; isManual: boolean } }) => {
        created.push(data);
        return { ...data };
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الاثنين",
    statuses: [{ teacherId: "absent-teacher", type: "ABSENT", fromPeriod: 2, toPeriod: 2 }],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 2);
  assert.equal(result.length, 2);
  assert.notEqual(created[0].substituteTeacherId, null);
  assert.notEqual(created[1].substituteTeacherId, null);
  assert.notEqual(created[0].substituteTeacherId, created[1].substituteTeacherId);
  assert.equal(new Set(created.map((row) => row.substituteTeacherId)).size, 2);
});

test("generateSubstitutions leaves a clear no-substitute record when nobody is free", async () => {
  const created: Array<{ substituteTeacherId: string | null; kind: string; isManual: boolean }> = [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 3,
          teacherId: "absent-teacher",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "absent-teacher", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "teacher-b",
          name: "المعلم المتاح",
          assignments: [
            {
              classId: "class-11a",
              subjectId: "science",
              class: { name: "الحادي عشر أ" },
              subject: { name: "علوم" }
            }
          ]
        }
      ]
    },
    dailyEvent: {
      findMany: async () => []
    },
    substitution: {
      create: async ({ data }: { data: { substituteTeacherId: string | null; kind: string; isManual: boolean } }) => {
        created.push(data);
        return { ...data };
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الاثنين",
    statuses: [
      { teacherId: "absent-teacher", type: "ABSENT", fromPeriod: 3, toPeriod: 3 },
      { teacherId: "teacher-b", type: "ABSENT", fromPeriod: 3, toPeriod: 3 }
    ],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 1);
  assert.equal(result.length, 1);
  assert.equal(created[0].substituteTeacherId, null);
  assert.equal(created[0].kind, "NO_SUBSTITUTE");
});
