import type { Student } from "@som/shared";
import type { GradeSection, GradeEntryRows } from "./gradeEntryTypes";
import { assertSpreadsheetImportFile } from "./spreadsheetImport.ts";

export type GradeImportCandidateRow = {
  name: string;
  nationalId: string;
  marks: Record<string, string>;
};

type ColumnMap = {
  nameIndex: number;
  nationalIdIndex: number;
  sectionIndexes: Record<string, number>;
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_.:-]+/g, " ");
}

function normalizeCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function isBlankRow(row: unknown[]) {
  return row.every((cell) => normalizeCellText(cell) === "");
}

function buildSectionAliases(section: GradeSection) {
  return new Set([
    normalizeHeader(section.id),
    normalizeHeader(section.name),
    normalizeHeader(section.name.replace(/\s+/g, " "))
  ]);
}

function resolveColumns(headers: unknown[], sections: GradeSection[]): ColumnMap {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const nameAliases = [normalizeHeader("اسم الطالب"), normalizeHeader("student name"), normalizeHeader("name")];
  const nationalIdAliases = [
    normalizeHeader("رقم الهوية"),
    normalizeHeader("national id"),
    normalizeHeader("nationalid"),
    normalizeHeader("id")
  ];
  const sectionIndexes: Record<string, number> = {};

  const nameIndex = normalizedHeaders.findIndex((header) => nameAliases.includes(header));
  const nationalIdIndex = normalizedHeaders.findIndex((header) => nationalIdAliases.includes(header));

  sections.forEach((section, sectionPosition) => {
    const aliases = buildSectionAliases(section);
    const matchedIndex = normalizedHeaders.findIndex((header) => aliases.has(header));
    sectionIndexes[section.id] = matchedIndex >= 0 ? matchedIndex : sectionPosition + 2;
  });

  return {
    nameIndex: nameIndex >= 0 ? nameIndex : 0,
    nationalIdIndex: nationalIdIndex >= 0 ? nationalIdIndex : 1,
    sectionIndexes
  };
}

export function parseGradeImportRows(rows: unknown[][], sections: GradeSection[]): GradeImportCandidateRow[] {
  if (!rows.length) return [];
  const firstRow = rows[0] || [];
  const hasHeaders = firstRow.some((cell) => {
    const header = normalizeHeader(cell);
    return (
      header === normalizeHeader("اسم الطالب") ||
      header === normalizeHeader("student name") ||
      header === normalizeHeader("رقم الهوية") ||
      header === normalizeHeader("national id") ||
      sections.some((section) => buildSectionAliases(section).has(header))
    );
  });
  const columns = resolveColumns(hasHeaders ? firstRow : [], sections);
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => Array.isArray(row) && !isBlankRow(row))
    .map((row) => {
      const name = normalizeCellText(row[columns.nameIndex]);
      const nationalId = normalizeCellText(row[columns.nationalIdIndex]);
      const marks = sections.reduce<Record<string, string>>((accumulator, section) => {
        const value = normalizeCellText(row[columns.sectionIndexes[section.id]]);
        accumulator[section.id] = value;
        return accumulator;
      }, {});
      return { name, nationalId, marks };
    })
    .filter((row) => Boolean(row.name || row.nationalId || Object.values(row.marks).some((value) => value !== "")));
}

export function buildGradeImportRows(
  students: Student[],
  sections: GradeSection[],
  rows: GradeImportCandidateRow[]
): GradeEntryRows {
  const output: GradeEntryRows = {};
  const studentLookup = new Map<string, Student>();

  for (const student of students) {
    const keyCandidates = [student.nationalId?.trim(), student.name?.trim().toLowerCase()].filter(
      (value): value is string => Boolean(value)
    );
    for (const key of keyCandidates) {
      if (!studentLookup.has(key)) {
        studentLookup.set(key, student);
      }
    }
  }

  for (const row of rows) {
    const lookupKey = row.nationalId.trim() || row.name.trim().toLowerCase();
    const matchedStudent = studentLookup.get(lookupKey);
    if (!matchedStudent?.id) continue;
    output[matchedStudent.id] = sections.reduce<Record<string, string>>((marks, section) => {
      marks[section.id] = row.marks[section.id] || "";
      return marks;
    }, {});
  }

  return output;
}

export async function parseGradeImportFile(file: File, sections: GradeSection[]) {
  assertSpreadsheetImportFile(file);
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("لا توجد ورقة عمل في ملف Excel");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) return [];
  return parseGradeImportRows(rows, sections);
}
