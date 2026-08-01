import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStudentImportDuplicateWhere } from "./studentIdentity";

type StudentRecord = {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  nationalId: string | null;
  fatherName: string | null;
  motherName: string | null;
  fatherPhone: string | null;
  motherPhone: string | null;
  guardianPhone: string | null;
  studentPhone: string | null;
};

function simulateStudentImport(
  existingRows: StudentRecord[],
  importedRows: Array<Omit<StudentRecord, "id" | "schoolId">>
) {
  const created: StudentRecord[] = [];
  const updated: StudentRecord[] = [];

  for (const row of importedRows) {
    const duplicate = existingRows.find((existing) => {
      const where = buildStudentImportDuplicateWhere(existing.schoolId, row);
      const byNationalId = where.OR?.[0] && existing.nationalId === where.OR[0].nationalId;
      const byIdentity =
        where.OR?.[1] &&
        existing.name === where.OR[1].name &&
        existing.fatherName === where.OR[1].fatherName &&
        existing.motherName === where.OR[1].motherName &&
        existing.fatherPhone === where.OR[1].fatherPhone &&
        existing.motherPhone === where.OR[1].motherPhone &&
        existing.guardianPhone === where.OR[1].guardianPhone &&
        existing.studentPhone === where.OR[1].studentPhone;
      return where.schoolId === existing.schoolId && (byNationalId || byIdentity);
    });

    if (duplicate) {
      const next = { ...duplicate, ...row };
      updated.push(next);
      existingRows.splice(existingRows.indexOf(duplicate), 1, next);
      continue;
    }

    const next = { ...row, id: `student-${created.length + updated.length + 1}`, schoolId: "school-a" };
    created.push(next);
    existingRows.push(next);
  }

  return { created, updated, rows: existingRows };
}

test("student import keeps duplicated rows as updates instead of creating a second student", () => {
  const existingRows: StudentRecord[] = [
    {
      id: "student-1",
      schoolId: "school-a",
      classId: "class-10a",
      name: "حمزة",
      nationalId: "318535679",
      fatherName: "باسل",
      motherName: "سوسو",
      fatherPhone: "0001",
      motherPhone: "0002",
      guardianPhone: "0003",
      studentPhone: "0004"
    }
  ];

  const result = simulateStudentImport(existingRows, [
    {
      classId: "class-11a",
      name: "حمزة",
      nationalId: "318535679",
      fatherName: "باسل",
      motherName: "سوسو",
      fatherPhone: "0001",
      motherPhone: "0002",
      guardianPhone: "0003",
      studentPhone: "0004"
    },
    {
      classId: "class-11a",
      name: "ليان",
      nationalId: "318500000",
      fatherName: "خالد",
      motherName: "ريم",
      fatherPhone: "1111",
      motherPhone: "2222",
      guardianPhone: "3333",
      studentPhone: "4444"
    }
  ]);

  assert.equal(result.created.length, 1);
  assert.equal(result.updated.length, 1);
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].classId, "class-11a");
  assert.equal(result.rows[1].name, "ليان");
});

test("classroom logs report stitches lesson, homework, and exam rows into one timeline", () => {
  const source = readFileSync("src/modules/reports/reports.routes.ts", "utf8");

  assert.match(source, /reportsRouter\.get\("\/classroom-logs"/, "classroom logs report route should exist");
  assert.match(source, /teacherLessonToday\.findMany\(\{/, "classroom logs should include lesson today rows");
  assert.match(source, /teacherHomework\.findMany\(\{/, "classroom logs should include homework rows");
  assert.match(source, /teacherExam\.findMany\(\{/, "classroom logs should include exam rows");
  assert.match(source, /type: "LESSON_TODAY"/, "lesson today rows should be typed distinctly");
  assert.match(source, /type: "HOMEWORK"/, "homework rows should be typed distinctly");
  assert.match(source, /type: "EXAM"/, "exam rows should be typed distinctly");
  assert.match(
    source,
    /right\.date\.localeCompare\(left\.date\)/,
    "combined classroom log rows should be sorted newest first"
  );
  assert.match(source, /details:\s*\{\s*status: item\.status,/, "lesson rows should keep their status details");
  assert.match(source, /details:\s*\{\s*kind: item\.kind,/, "homework rows should keep their homework details");
  assert.match(source, /details:\s*\{\s*startTime: item\.startTime,/, "exam rows should keep their exam details");
});
