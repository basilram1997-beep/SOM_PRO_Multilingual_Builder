import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generateSubstitutions } from "./substitutionEngine";

test("daily absence planning keeps manual substitutes and covered events from colliding", async () => {
  const created: Array<{ substituteTeacherId: string | null; isManual: boolean; kind: string; baseSlotId: string }> =
    [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 2,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-2",
          period: 3,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "teacher-b",
          name: "المعلم البديل",
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
          name: "المعلم المشغول",
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
      findMany: async () => [{ classId: "class-10a", fromPeriod: 3, toPeriod: 3 }]
    },
    substitution: {
      create: async ({
        data
      }: {
        data: { substituteTeacherId: string | null; isManual: boolean; kind: string; baseSlotId: string };
      }) => {
        created.push(data);
        return { ...data } as never;
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الأحد",
    statuses: [{ teacherId: "teacher-a", type: "ABSENT", fromPeriod: 2, toPeriod: 2 }],
    manualSubstitutions: [{ baseScheduleSlotId: "slot-1", substituteTeacherId: "teacher-b" }],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 1);
  assert.equal(created[0].baseSlotId, "slot-1");
  assert.equal(created[0].substituteTeacherId, "teacher-b");
  assert.equal(created[0].isManual, true);
  assert.equal(created[0].kind, "SAME_CLASS_AND_SUBJECT");
  assert.equal(result.length, 1);
  assert.equal(result[0].baseSlotId, "slot-1");
});

test("attendance, grades, certificates, reports, and archive flows stay connected through the same saved rows", () => {
  const studentsSource = readFileSync("src/modules/students/students.routes.ts", "utf8");
  const reportsSource = readFileSync("src/modules/reports/reports.routes.ts", "utf8");
  const archiveSource = readFileSync("src/modules/archive/archive.routes.ts", "utf8");
  const subjectsSource = readFileSync("src/modules/subjects/subjects.routes.ts", "utf8");

  assert.match(studentsSource, /studentsRouter\.get\("\/attendance"/, "attendance listing route should still exist");
  assert.match(studentsSource, /studentsRouter\.put\("\/attendance"/, "attendance save route should still exist");
  assert.match(studentsSource, /studentAttendance\.upsert\(/, "attendance should be stored with an upsert");
  assert.match(studentsSource, /studentsRouter\.post\("\/grades"/, "grade save route should still exist");
  assert.match(studentsSource, /studentGradeEntry\.upsert\(/, "grades should be stored with an upsert");
  assert.match(studentsSource, /studentsRouter\.post\("\/certificates"/, "certificate save route should still exist");
  assert.match(studentsSource, /studentCertificate\.upsert\(/, "certificate save should update the same saved row");
  assert.match(studentsSource, /studentsRouter\.put\("\/:id"/, "student update route should still exist");
  assert.match(studentsSource, /buildStudentDuplicateWhere/, "student moves should keep duplicate checks in place");

  assert.match(reportsSource, /reportsRouter\.get\("\/attendance"/, "attendance report route should still exist");
  assert.match(reportsSource, /studentAttendance\.findMany\(\{/, "attendance report should read saved attendance rows");
  assert.match(reportsSource, /reportsRouter\.get\("\/grades"/, "grades report route should still exist");
  assert.match(reportsSource, /studentGradeEntry\.findMany\(\{/, "grades report should read saved grade rows");
  assert.match(reportsSource, /buildCountMap\(attendance/, "attendance reporting should count from the stored rows");
  assert.match(reportsSource, /buildCountMap\(grades/, "grade reporting should count from the stored rows");
  assert.match(reportsSource, /reportsRouter\.post\("\/export-events"/, "export audit route should still exist");
  assert.match(reportsSource, /createReportExportRecord\(prisma,/, "report exports should be recorded in the database");

  assert.match(
    archiveSource,
    /latestArchiveSnapshots\(schoolId\)/,
    "archive snapshots should be reused for repeated saves"
  );
  assert.match(
    archiveSource,
    /archivedUpdatedAt === currentUpdatedAt/,
    "archive should skip duplicate saves when the snapshot is unchanged"
  );

  assert.match(
    subjectsSource,
    /subjectsRouter\.post\("\/:id\/deactivate"/,
    "subject deactivate route should still exist"
  );
  assert.match(
    subjectsSource,
    /subject\.update\(\{[\s\S]*status: "ARCHIVED"/,
    "subject deactivation should keep the subject row and protect historical grades"
  );
  assert.doesNotMatch(
    subjectsSource,
    /subject\.delete\(\{ where: \{ id: existing\.id \} \}\);/,
    "subject deactivation should no longer hard-delete the subject row"
  );
});

test("teacher, class, and homeroom routing keep schedule updates in sync with the weekly timetable", () => {
  const classesSource = readFileSync("src/modules/classes/classes.routes.ts", "utf8");
  const homeroomSource = readFileSync("src/modules/homeroom/homeroom.routes.ts", "utf8");
  const scheduleSource = readFileSync("src/services/scheduleCoordinator.ts", "utf8");

  assert.match(
    classesSource,
    /applyHomeroomsToBaseScheduleFromRules\(/,
    "class edits should refresh the base schedule rules"
  );
  assert.match(classesSource, /classesRouter\.(patch|put)\("\/:id"/, "class edit routes should remain available");
  assert.match(
    classesSource,
    /classesRouter\.post\("\/:id\/assign-homeroom-teacher"/,
    "homeroom assignment route should still exist"
  );

  assert.match(
    homeroomSource,
    /saveHomeroomAssignment|homeroomAssignment\.upsert\(/,
    "homeroom saves should keep using the same assignment row"
  );
  assert.match(
    homeroomSource,
    /applyHomeroomsToBaseScheduleFromRules\(/,
    "homeroom saves should refresh the timetable"
  );

  assert.match(
    scheduleSource,
    /generateSubstitutions\(/,
    "daily schedule generation should still invoke substitution planning"
  );
  assert.match(
    scheduleSource,
    /dailyEvent\.findFirst\(\{/,
    "daily event generation should update-or-create matching events"
  );
});

test("daily absence planning keeps a covered event from being treated as busy while selecting substitutes", async () => {
  const created: Array<{ substituteTeacherId: string | null; isManual: boolean; kind: string; baseSlotId: string }> =
    [];
  const fakeDb = {
    baseScheduleSlot: {
      findMany: async () => [
        {
          id: "slot-1",
          period: 2,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        },
        {
          id: "slot-2",
          period: 2,
          teacherId: "teacher-a",
          classId: "class-10a",
          subjectId: "math",
          teacher: { id: "teacher-a", name: "المعلم الغائب" },
          class: { name: "العاشر أ" },
          subject: { name: "رياضيات" }
        }
      ]
    },
    teacher: {
      findMany: async () => [
        {
          id: "teacher-b",
          name: "المعلم البديل",
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
      create: async ({
        data
      }: {
        data: { substituteTeacherId: string | null; isManual: boolean; kind: string; baseSlotId: string };
      }) => {
        created.push(data);
        return { ...data } as never;
      }
    }
  } as never;

  const result = await generateSubstitutions({
    schoolId: "school-a",
    dailyScheduleId: "daily-a",
    day: "الأحد",
    statuses: [{ teacherId: "teacher-a", type: "ABSENT", fromPeriod: 2, toPeriod: 2 }],
    manualSubstitutions: [],
    settings: { periodsPerDay: 7 },
    db: fakeDb
  });

  assert.equal(created.length, 2);
  assert.equal(result.length, 2);
  assert.equal(created[0].kind, "SAME_CLASS_AND_SUBJECT");
  assert.equal(created[1].kind, "NO_SUBSTITUTE");
});
