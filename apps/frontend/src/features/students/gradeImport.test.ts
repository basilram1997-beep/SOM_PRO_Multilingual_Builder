import test from "node:test";
import assert from "node:assert/strict";
import { buildGradeImportRows, parseGradeImportRows } from "./gradeImport.ts";
import { SPREADSHEET_IMPORT_MAX_BYTES, assertSpreadsheetImportFile } from "./spreadsheetImport.ts";

const sections = [
  { id: "marks", name: "العلامات", percentage: 20, outOf: 20 },
  { id: "final-exam", name: "تقييم النهائي", percentage: 40, outOf: 40 }
];

const students = [
  { id: "student-a", name: "حمزة", nationalId: "318535679", classId: "class-a" },
  { id: "student-b", name: "ليان", nationalId: "318500001", classId: "class-a" }
];

test("grade import rows parse headers and map section columns", () => {
  const rows = parseGradeImportRows(
    [
      ["اسم الطالب", "رقم الهوية", "العلامات", "تقييم النهائي"],
      ["حمزة", "318535679", "8", "18"],
      ["ليان", "318500001", "10", "20"]
    ],
    sections
  );

  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    name: "حمزة",
    nationalId: "318535679",
    marks: { marks: "8", "final-exam": "18" }
  });
  assert.deepEqual(rows[1], {
    name: "ليان",
    nationalId: "318500001",
    marks: { marks: "10", "final-exam": "20" }
  });
});

test("grade import rows can also map into the current student roster and update repeated rows", () => {
  const rows = buildGradeImportRows(students, sections, [
    { name: "حمزة", nationalId: "318535679", marks: { marks: "8", "final-exam": "18" } },
    { name: "ليان", nationalId: "318500001", marks: { marks: "10", "final-exam": "20" } },
    { name: "حمزة", nationalId: "318535679", marks: { marks: "9", "final-exam": "19" } }
  ]);

  assert.deepEqual(rows["student-a"], { marks: "9", "final-exam": "19" });
  assert.deepEqual(rows["student-b"], { marks: "10", "final-exam": "20" });
});

test("grade import rows ignore blank rows and unmatched students", () => {
  const rows = parseGradeImportRows(
    [
      ["اسم الطالب", "رقم الهوية", "العلامات", "تقييم النهائي"],
      ["", "", "", ""],
      ["اسم غير معروف", "999999999", "7", "7"]
    ],
    sections
  );

  const mapped = buildGradeImportRows(students, sections, rows);

  assert.equal(rows.length, 1);
  assert.equal(Object.keys(mapped).length, 0);
});

test("spreadsheet import validator accepts only small xlsx files", () => {
  assert.doesNotThrow(() =>
    assertSpreadsheetImportFile({
      name: "students.xlsx",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: SPREADSHEET_IMPORT_MAX_BYTES
    } as File)
  );

  assert.throws(
    () =>
      assertSpreadsheetImportFile({
        name: "students.xls",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: 1024
      } as File),
    /xlsx/
  );

  assert.throws(
    () =>
      assertSpreadsheetImportFile({
        name: "students.xlsx",
        type: "text/csv",
        size: 1024
      } as File),
    /غير صالح/
  );

  assert.throws(
    () =>
      assertSpreadsheetImportFile({
        name: "students.xlsx",
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: SPREADSHEET_IMPORT_MAX_BYTES + 1
      } as File),
    /الحد المسموح/
  );
});
