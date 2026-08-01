import test from "node:test";
import assert from "node:assert/strict";
import { examTimeOverlaps, findExamConflicts } from "./examSchedule";

test("exam time overlap detects intersecting time ranges", () => {
  assert.equal(examTimeOverlaps("08:00", "09:00", "08:30", "09:30"), true);
  assert.equal(examTimeOverlaps("08:00", "09:00", "09:00", "10:00"), false);
  assert.equal(examTimeOverlaps("08:00", "09:00", "07:00", "08:00"), false);
});

test("exam conflicts only match the same class on the same date", () => {
  const exams = [
    { id: "a", classId: "class-a", date: "2026-07-10", startTime: "08:00", endTime: "09:00" },
    { id: "b", classId: "class-a", date: "2026-07-10", startTime: "08:30", endTime: "09:30" },
    { id: "c", classId: "class-b", date: "2026-07-10", startTime: "08:30", endTime: "09:30" },
    { id: "d", classId: "class-a", date: "2026-07-11", startTime: "08:30", endTime: "09:30" }
  ];

  const conflicts = findExamConflicts(exams, exams[0]);

  assert.deepEqual(
    conflicts.map((item) => item.id),
    ["b"]
  );
});
