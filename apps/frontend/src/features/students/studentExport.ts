import { buildExportNotice, recordExportAction, type ExportNotice } from "../exports/exportAudit";
import type { StudentRow } from "./studentTypes";

type ExportHeaderLabels = {
  name: string;
  nationalId: string;
  fatherName: string;
  motherName: string;
  residence: string;
  fatherPhone: string;
  motherPhone: string;
  guardianPhone: string;
  healthFund: string;
  studentPhone: string;
};

type ExportStudentWorkbookInput = {
  classLabel: string;
  fileNamePrefix: string;
  headers: ExportHeaderLabels;
  sheetName: string;
  title: string;
  students: StudentRow[];
  notice?: ExportNotice;
};

function normalizeFilePart(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/\s/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "students"
  );
}

export async function downloadStudentExportWorkbook({
  classLabel,
  fileNamePrefix,
  headers,
  sheetName,
  title,
  students,
  notice
}: ExportStudentWorkbookInput) {
  const lang = document.documentElement.lang;
  const privacyWarning =
    lang === "he"
      ? "הייצוא הזה פרטי ומוגבל בזמן."
      : lang === "en"
        ? "This export is private and expires automatically."
        : "هذا التصدير خاص ومؤقت وينتهي تلقائيًا بعد فترة قصيرة.";

  let finalNotice = notice || null;
  if (!finalNotice) {
    try {
      const result = await recordExportAction({
        page: "students",
        title,
        fileName: `${normalizeFilePart(fileNamePrefix)}.xlsx`,
        kind: "XLSX",
        permission: "manageTeachers",
        expiresInMinutes: 15
      });
      finalNotice = buildExportNotice(privacyWarning, result.expiresAt);
    } catch {
      finalNotice = buildExportNotice(privacyWarning, new Date(Date.now() + 15 * 60_000).toISOString());
    }
  }

  const XLSX = await import("xlsx");
  const rows = [
    [title],
    [finalNotice?.privacyWarning || ""],
    [finalNotice ? `Generated: ${finalNotice.generatedAt}` : ""],
    [finalNotice ? `Expires: ${finalNotice.expiresAt}` : ""],
    ["", ""],
    ["", classLabel],
    ["", String(students.length)],
    [],
    [
      headers.name,
      headers.nationalId,
      headers.fatherName,
      headers.motherName,
      headers.residence,
      headers.fatherPhone,
      headers.motherPhone,
      headers.guardianPhone,
      headers.healthFund,
      headers.studentPhone
    ],
    ...students.map((student) => [
      student.name || "",
      student.nationalId || "",
      student.fatherName || "",
      student.motherName || "",
      student.residence || "",
      student.fatherPhone || "",
      student.motherPhone || "",
      student.guardianPhone || "",
      student.healthFund || "",
      student.studentPhone || ""
    ])
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 24 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);

  const fileArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([fileArray], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${normalizeFilePart(fileNamePrefix)}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
