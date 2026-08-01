import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGradeEntryStorageKey,
  calculateWeightedTotal,
  countCompletedMarks,
  isCompletionBadgeComplete,
  isCompletionBadgeEmpty,
  normalizeGradeEntryDraft,
  readGradeEntryDraft,
  saveGradeEntryDraft,
  loadGradeEntryDraft,
  clearGradeEntryDraft
} from "./gradeEntryDraft.ts";
import { defaultGradeSections } from "./gradeEntryTypes.ts";

const sections = [
  { id: "daily-exam", name: "امتحان يومي", percentage: 10, outOf: 10 },
  { id: "attendance-participation", name: "حضور ومشاركة", percentage: 10, outOf: 10 },
  { id: "bimonthly-exam", name: "امتحان شهرين", percentage: 20, outOf: 20 }
];

test("grade entry storage key is stable and school-scoped", () => {
  assert.equal(
    buildGradeEntryStorageKey({
      schoolId: "school-a",
      teacherId: "teacher-a",
      classId: "class-a",
      subjectId: "subject-a",
      certificateType: "TERM1_BIMONTHLY"
    }),
    "som-pro:grade-entry:school-a:teacher-a:class-a:subject-a:TERM1_BIMONTHLY"
  );
});

test("weighted grade total is calculated and capped to the maximum", () => {
  const total = calculateWeightedTotal(
    { "daily-exam": "10", "attendance-participation": "10", "bimonthly-exam": "20" },
    sections,
    40
  );

  assert.equal(total, 40);

  const capped = calculateWeightedTotal(
    { "daily-exam": "40", "attendance-participation": "40", "bimonthly-exam": "80" },
    sections,
    40
  );

  assert.equal(capped, 40);
});

test("weighted grade total rejects invalid or missing inputs and floors negative totals", () => {
  assert.equal(
    calculateWeightedTotal(
      { "daily-exam": "", "attendance-participation": "10", "bimonthly-exam": "20" },
      sections,
      40
    ),
    null
  );
  assert.equal(
    calculateWeightedTotal(
      { "daily-exam": "x", "attendance-participation": "10", "bimonthly-exam": "20" },
      sections,
      40
    ),
    null
  );
  assert.equal(
    calculateWeightedTotal(
      { "daily-exam": "-10", "attendance-participation": "0", "bimonthly-exam": "0" },
      sections,
      40
    ),
    0
  );
});

test("weighted grade total handles decimals, zero, and overflowing inputs", () => {
  assert.equal(
    calculateWeightedTotal(
      { "daily-exam": "10", "attendance-participation": "10", "bimonthly-exam": "20" },
      sections,
      40
    ),
    40
  );
  assert.equal(
    calculateWeightedTotal({ "daily-exam": "0", "attendance-participation": "0", "bimonthly-exam": "0" }, sections, 40),
    0
  );
  assert.equal(
    calculateWeightedTotal(
      { "daily-exam": "100", "attendance-participation": "100", "bimonthly-exam": "100" },
      sections,
      40
    ),
    40
  );
});

test("default grade sections use the expected term weights", () => {
  assert.deepEqual(
    defaultGradeSections("TERM1_BIMONTHLY").map((section) => ({
      id: section.id,
      percentage: section.percentage,
      outOf: section.outOf
    })),
    [
      { id: "daily-exam", percentage: 10, outOf: 10 },
      { id: "attendance-participation", percentage: 10, outOf: 10 },
      { id: "bimonthly-exam", percentage: 20, outOf: 20 }
    ]
  );

  assert.deepEqual(
    defaultGradeSections("TERM2_FINAL").map((section) => ({
      id: section.id,
      percentage: section.percentage,
      outOf: section.outOf
    })),
    [
      { id: "daily-exam", percentage: 10, outOf: 10 },
      { id: "attendance-participation", percentage: 10, outOf: 10 },
      { id: "final-exam", percentage: 40, outOf: 40 }
    ]
  );
});

test("completion helpers reflect batch entry progress", () => {
  const rows = {
    "student-a": { "daily-exam": "8", "attendance-participation": "7", "bimonthly-exam": "9" },
    "student-b": { "daily-exam": " ", "attendance-participation": "", "bimonthly-exam": "" },
    "student-c": { "daily-exam": "10", "attendance-participation": "9", "bimonthly-exam": "10" }
  };

  assert.equal(countCompletedMarks(rows, ["student-a", "student-b", "student-c"], "daily-exam"), 2);
  assert.equal(countCompletedMarks(rows, ["student-a", "student-b", "student-c"], "bimonthly-exam"), 2);
  assert.equal(isCompletionBadgeComplete(3, 3), true);
  assert.equal(isCompletionBadgeComplete(2, 3), false);
  assert.equal(isCompletionBadgeEmpty(0), true);
  assert.equal(isCompletionBadgeEmpty(1), false);
});

test("grade entry draft normalization keeps students and sections aligned", () => {
  const normalized = normalizeGradeEntryDraft(
    {
      rows: {
        "student-a": { "daily-exam": "8" }
      },
      updatedAt: "2026-07-19T00:00:00.000Z"
    },
    ["student-a", "student-b"],
    sections
  );

  assert.deepEqual(normalized.rows["student-a"], {
    "daily-exam": "8",
    "attendance-participation": "",
    "bimonthly-exam": ""
  });
  assert.deepEqual(normalized.rows["student-b"], {
    "daily-exam": "",
    "attendance-participation": "",
    "bimonthly-exam": ""
  });
  assert.equal(normalized.updatedAt, "2026-07-19T00:00:00.000Z");
});

test("invalid stored drafts are rejected safely", () => {
  assert.equal(readGradeEntryDraft(null), null);
  assert.equal(readGradeEntryDraft('{"rows":{}'), null);
  assert.equal(
    readGradeEntryDraft(JSON.stringify({ rows: { student: { "daily-exam": 7 } } }))?.rows.student["daily-exam"],
    ""
  );
});

test("saved grade drafts can be updated and reloaded without duplicating old values", () => {
  const storageKey = buildGradeEntryStorageKey({
    schoolId: "school-a",
    teacherId: "teacher-a",
    classId: "class-a",
    subjectId: "subject-a",
    certificateType: "TERM1_BIMONTHLY"
  });

  clearGradeEntryDraft(storageKey);
  saveGradeEntryDraft(storageKey, {
    rows: { "student-a": { "daily-exam": "8", "attendance-participation": "7", "bimonthly-exam": "6" } },
    updatedAt: "2026-07-19T00:00:00.000Z"
  });
  saveGradeEntryDraft(storageKey, {
    rows: { "student-a": { "daily-exam": "9", "attendance-participation": "8", "bimonthly-exam": "7" } },
    updatedAt: "2026-07-19T00:05:00.000Z"
  });

  const reloaded = loadGradeEntryDraft(storageKey);
  assert.deepEqual(reloaded?.rows["student-a"], {
    "daily-exam": "9",
    "attendance-participation": "8",
    "bimonthly-exam": "7"
  });
  assert.ok(reloaded && reloaded.updatedAt);

  clearGradeEntryDraft(storageKey);
});
