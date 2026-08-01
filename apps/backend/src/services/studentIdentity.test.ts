import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { StudentSchema } from "@som/shared";
import { buildStudentDuplicateWhere, buildStudentImportDuplicateWhere } from "./studentIdentity";

test("student identity duplicate filters include stable school and class scope", () => {
  const where = buildStudentDuplicateWhere("school-a", "class-a", {
    name: "حمزة",
    nationalId: "318535679",
    fatherName: "باسل",
    motherName: "سوسو",
    fatherPhone: "0001",
    motherPhone: "0002",
    guardianPhone: "0003",
    studentPhone: "0004"
  });

  assert.equal(where.schoolId, "school-a");
  assert.equal(where.classId, "class-a");
  assert.equal(where.OR?.length, 2);
  assert.deepEqual(where.OR?.[0], { nationalId: "318535679" });
  assert.deepEqual(where.OR?.[1], {
    name: "حمزة",
    fatherName: "باسل",
    motherName: "سوسو",
    fatherPhone: "0001",
    motherPhone: "0002",
    guardianPhone: "0003",
    studentPhone: "0004"
  });
});

test("student schema accepts valid multilingual names and optional contact fields", () => {
  const student = StudentSchema.parse({
    name: "\u0637\u0627\u0644\u0628 \u0627\u062e\u062a\u0628\u0627\u0631 / Test Student \u0627\u0644\u0637\u0648\u064a\u0644",
    nationalId: "318535679",
    classId: "class-a",
    fatherName: "\u0628\u0627\u0633\u0644",
    motherName: "\u0633\u0648\u0633\u0648",
    residence: "\u062d\u064a \u0627\u0644\u0645\u062f\u064a\u0646\u0629",
    fatherPhone: "",
    motherPhone: null,
    guardianPhone: undefined,
    healthFund: "",
    studentPhone: "0500000000"
  });

  assert.equal(
    student.name,
    "\u0637\u0627\u0644\u0628 \u0627\u062e\u062a\u0628\u0627\u0631 / Test Student \u0627\u0644\u0637\u0648\u064a\u0644"
  );
  assert.equal(student.nationalId, "318535679");
  assert.equal(student.classId, "class-a");
  assert.equal(student.fatherPhone, "");
  assert.equal(student.motherPhone, null);
  assert.equal(student.guardianPhone, undefined);
});

test("student schema rejects missing required name and class values", () => {
  assert.throws(
    () =>
      StudentSchema.parse({
        nationalId: "318535679",
        classId: "class-a"
      }),
    /name/
  );

  assert.throws(
    () =>
      StudentSchema.parse({
        name: "Test Student",
        nationalId: "318535679",
        classId: ""
      }),
    /classId/
  );
});

test("student identity filters keep duplicate lookups class-scoped while preserving long multilingual names", () => {
  const longName =
    "\u0627\u0644\u0637\u0627\u0644\u0628 \u0627\u0644\u0645\u062e\u062a\u0628\u0631 / Long Test Student Name With Multiple Parts";
  const where = buildStudentDuplicateWhere("school-a", "class-a", {
    name: longName,
    nationalId: "318535679"
  });

  assert.equal(where.schoolId, "school-a");
  assert.equal(where.classId, "class-a");
  assert.deepEqual(where.OR?.[0], { nationalId: "318535679" });
  assert.deepEqual(where.OR?.[1], { name: longName });
});

test("student identity duplicate filters exclude the current record when editing", () => {
  const where = buildStudentDuplicateWhere(
    "school-a",
    "class-a",
    {
      name: "حمزة",
      nationalId: "318535679"
    },
    "student-current"
  );

  assert.deepEqual(where.id, { not: "student-current" });
});

test("student import route updates an existing duplicate instead of creating a second record", () => {
  const source = readFileSync("src/modules/students/students.routes.ts", "utf8");

  assert.match(
    source,
    /studentsRouter\.post\("\/import"|\(0, auth_1\.requirePermissionForWrite\)\("manageSettings"\).*?studentsRouter\.post\("\/import"/s,
    "student import route should exist"
  );
  assert.match(
    source,
    /buildStudentImportDuplicateWhere\(schoolId, payload\)|\(0, studentIdentity_1\.buildStudentImportDuplicateWhere\)\(schoolId, payload\)/,
    "student import should compare imported rows against school-wide duplicates"
  );
  assert.match(
    source,
    /getClassCapacityState\(transaction, schoolId, classId\)/,
    "student import should check class capacity inside the transaction"
  );
  assert.match(source, /CLASS_FULL/, "student import should reject over-capacity batches");
  assert.match(source, /studentsRouter\.post\("\/:id\/move"/, "student move route should exist");
  assert.match(
    source,
    /transaction\.student\.update\(/,
    "student import should update the existing record when a duplicate is found"
  );
  assert.match(
    source,
    /transaction\.student\.create\(/,
    "student import should still create new records when no duplicate exists"
  );
});

test("student import duplicate lookup can move an existing student to a new class without creating a second record", () => {
  const where = buildStudentImportDuplicateWhere("school-a", {
    name: "حمزة",
    nationalId: "318535679",
    fatherName: "باسل",
    motherName: "سوسو",
    fatherPhone: "0001",
    motherPhone: "0002",
    guardianPhone: "0003",
    studentPhone: "0004"
  });

  assert.equal(where.schoolId, "school-a");
  assert.equal(where.classId, undefined);
  assert.equal(where.OR?.length, 2);
  assert.deepEqual(where.OR?.[0], { nationalId: "318535679" });
  assert.deepEqual(where.OR?.[1], {
    name: "حمزة",
    fatherName: "باسل",
    motherName: "سوسو",
    fatherPhone: "0001",
    motherPhone: "0002",
    guardianPhone: "0003",
    studentPhone: "0004"
  });
});
