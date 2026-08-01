export const SPREADSHEET_IMPORT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [".xlsx"];
const ALLOWED_MIME_TYPES = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

function hasAllowedExtension(fileName: string) {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isAllowedMimeType(type: string) {
  return ALLOWED_MIME_TYPES.includes(type.toLowerCase());
}

export function assertSpreadsheetImportFile(file: File) {
  if (!hasAllowedExtension(file.name)) {
    throw new Error("يسمح فقط بملفات Excel بصيغة .xlsx");
  }

  if (!isAllowedMimeType(file.type)) {
    throw new Error("نوع الملف غير صالح لرفع Excel");
  }

  if (file.size > SPREADSHEET_IMPORT_MAX_BYTES) {
    throw new Error("حجم ملف Excel أكبر من الحد المسموح");
  }
}
