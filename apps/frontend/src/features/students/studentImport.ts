import type { StudentImportRow } from "./studentTypes";
import { assertSpreadsheetImportFile } from "./spreadsheetImport.ts";

const FIELD_ALIASES: Record<keyof StudentImportRow, string[]> = {
  name: ["اسم الطالب", "الاسم", "student name", "name"],
  nationalId: ["رقم الهوية", "الهوية", "national id", "nationalid", "id"],
  fatherName: ["اسم الأب", "اسم الاب", "father name", "father"],
  motherName: ["اسم الأم", "اسم الام", "mother name", "mother"],
  residence: ["مكان السكن", "السكن", "residence", "address"],
  fatherPhone: ["رقم هاتف الأب", "هاتف الأب", "father phone", "phone father"],
  motherPhone: ["رقم هاتف الأم", "هاتف الأم", "mother phone", "phone mother"],
  guardianPhone: ["رقم هاتف الوصي", "هاتف الوصي", "guardian phone", "guardian"],
  healthFund: ["صندوق المرضى", "health fund", "healthfund"],
  studentPhone: ["رقم هاتف الطالب", "هاتف الطالب", "student phone"]
};

const IMPORT_HEADERS = [
  "الاسم",
  "الرقم الوطني",
  "اسم الأب",
  "اسم الأم",
  "مكان السكن",
  "رقم هاتف الأب",
  "رقم هاتف الأم",
  "رقم هاتف الوصي",
  "صندوق المرضى",
  "رقم هاتف الطالب"
];

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_.:-]+/g, " ");
}

function toCellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function readField(row: unknown[], index: number) {
  return toCellText(row[index]);
}

function isBlankRow(row: unknown[]) {
  return row.every((cell) => !toCellText(cell));
}

function resolveColumnMap(headers: unknown[]) {
  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const result = new Map<keyof StudentImportRow, number>();

  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[keyof StudentImportRow, string[]]>) {
    const index = normalizedHeaders.findIndex((header) => aliases.some((alias) => header === normalizeHeader(alias)));
    if (index >= 0) result.set(field, index);
  }

  return result;
}

function readFromColumns(row: unknown[], columns: Map<keyof StudentImportRow, number>): StudentImportRow {
  const firstColumn = (field: keyof StudentImportRow, fallbackIndex: number) => {
    const mapped = columns.get(field);
    return readField(row, mapped ?? fallbackIndex);
  };

  return {
    name: firstColumn("name", 0),
    nationalId: firstColumn("nationalId", 1),
    fatherName: firstColumn("fatherName", 2),
    motherName: firstColumn("motherName", 3),
    residence: firstColumn("residence", 4),
    fatherPhone: firstColumn("fatherPhone", 5),
    motherPhone: firstColumn("motherPhone", 6),
    guardianPhone: firstColumn("guardianPhone", 7),
    healthFund: firstColumn("healthFund", 8),
    studentPhone: firstColumn("studentPhone", 9)
  };
}

export async function parseStudentImportFile(file: File): Promise<StudentImportRow[]> {
  assertSpreadsheetImportFile(file);
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("لا توجد ورقة عمل في ملف Excel");

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
  if (!rows.length) return [];

  const firstRow = rows[0] || [];
  const columns = resolveColumnMap(firstRow);
  const hasHeaders = columns.size > 0;
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  return dataRows
    .filter((row) => Array.isArray(row) && !isBlankRow(row))
    .map((row) => readFromColumns(row as unknown[], columns))
    .filter((student) => Boolean(student.name.trim()));
}

export async function downloadStudentImportTemplate() {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([IMPORT_HEADERS]);
  XLSX.utils.book_append_sheet(workbook, sheet, "نموذج الطلاب");
  const fileArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([fileArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "student-import-template.xlsx";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
