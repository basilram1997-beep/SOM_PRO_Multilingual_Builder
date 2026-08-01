import { buildExportNotice, recordExportAction, type ExportNotice } from "../exports/exportAudit";
import type { Translate } from "./dailyTypes";

export function statusLabel(type: string, t: Translate) {
  if (type === "ABSENT") return t("daily.absent");
  if (type === "LATE") return t("daily.late");
  if (type === "LEFT") return t("daily.left");
  return t("daily.mission");
}

export function substitutionKindLabel(kind: string, t: Translate) {
  if (kind === "SAME_CLASS_AND_SUBJECT") return t("daily.kindSameClassAndSubject");
  if (kind === "SAME_CLASS") return t("daily.kindSameClass");
  if (kind === "SAME_GRADE_AND_SUBJECT") return t("daily.kindSameGradeAndSubject");
  if (kind === "SAME_SUBJECT") return t("daily.kindSameSubject");
  if (kind === "SAME_GRADE") return t("daily.kindSameGrade");
  if (kind === "FREE_ONLY") return t("daily.kindFreeOnly");
  return t("daily.noSubstitute");
}

export function lessonTypeLabel(type: string, substituteForName: string | null | undefined, t: Translate) {
  if (type === "SUBSTITUTION")
    return substituteForName ? t("daily.substitutionFor") + " " + substituteForName : t("daily.substitution");
  if (type === "UNAVAILABLE_ORIGINAL") return t("daily.affectedLesson");
  return t("daily.originalLesson");
}

export function lessonClass(type: string) {
  if (type === "SUBSTITUTION") return "substitution-period";
  if (type === "UNAVAILABLE_ORIGINAL") return "unavailable-original-period";
  return "original-period";
}

async function recordSectionExport(sectionId: string, title: string, fileName: string) {
  const lang = document.documentElement.lang;
  const privacyWarning =
    lang === "he"
      ? "הייצוא הזה פרטי ומוגבל לזמן קצר."
      : lang === "en"
        ? "This export is private and expires automatically."
        : "هذا التصدير خاص ومؤقت وينتهي تلقائيًا بعد فترة قصيرة.";

  const mapping: Record<
    string,
    {
      page: string;
      permission: "read" | "manageTeachers" | "manageSchedules" | "manageSettings" | "manageLicense" | "manageLessons";
    }
  > = {
    "attendance-report-print": { page: "studentAttendance", permission: "manageLessons" },
    "security-report-print": { page: "securityMonitoring", permission: "manageSettings" },
    "daily-report-print": { page: "reports", permission: "read" },
    "daily-free-teachers-section": { page: "daily", permission: "manageSchedules" },
    "daily-full-schedule-section": { page: "daily", permission: "manageSchedules" },
    "daily-substitutions-section": { page: "daily", permission: "manageSchedules" },
    "teacher-programs-section": { page: "daily", permission: "manageSchedules" },
    "daily-duties-section": { page: "daily", permission: "manageSchedules" }
  };

  const meta = mapping[sectionId];
  if (!meta) return null;

  try {
    const result = await recordExportAction({
      page: meta.page,
      title,
      fileName,
      kind: "PDF",
      permission: meta.permission,
      expiresInMinutes: 15
    });
    return buildExportNotice(privacyWarning, result.expiresAt);
  } catch {
    return null;
  }
}

export async function exportSectionPdf(
  sectionId: string,
  title: string,
  notice?: ExportNotice,
  options?: { skipAudit?: boolean }
) {
  const el = document.getElementById(sectionId);
  if (!el) return alert("تعذر العثور على القسم المطلوب للتصدير");

  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "som-pro-export";
  const exportNotice =
    notice || (options?.skipAudit ? null : await recordSectionExport(sectionId, title, `${safeTitle}.html`));
  const noticeHtml = exportNotice
    ? `<div class="export-notice" style="border:1px solid #cbd5e1;background:#eff6ff;padding:8px 10px;margin:0 0 12px;border-radius:10px;font-size:11px;line-height:1.5;color:#0f172a"><strong style="display:block;margin-bottom:4px">${exportNotice.privacyWarning}</strong><span>Generated: ${exportNotice.generatedAt}</span><br /><span>Expires: ${exportNotice.expiresAt}</span></div>`
    : "";
  const specialPrintStyles =
    sectionId === "attendance-report-print"
      ? `
      @page{size:A4 portrait;margin:10mm}
      body{margin:0;padding:0;background:#fff}
      h1{margin:0 0 12px;padding:0 0 10px;border-bottom:2px solid #cbd5e1;letter-spacing:.2px}
      .attendance-report-print{display:grid;gap:12px}
      .attendance-report-print .card{border:1px solid #94a3b8;box-shadow:none;break-inside:avoid;page-break-inside:avoid;background:#fff}
      .attendance-report-print .card-header{padding-bottom:8px;margin-bottom:8px;border-bottom:1px solid #e2e8f0}
      .attendance-report-print .card-header h2{margin:0;font-size:15px;color:#0f172a}
      .attendance-report-print .attendance-controls{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px}
      .attendance-report-print .attendance-controls label{font-size:12px;min-height:auto;padding:10px 12px;background:#fff}
      .attendance-report-print .attendance-summary{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .attendance-report-print .attendance-summary-card,
      .attendance-report-print .attendance-archive-report div{box-shadow:none}
      .attendance-report-print .attendance-summary-card{padding:12px 14px}
      .attendance-report-print .attendance-summary-card strong{font-size:22px}
      .attendance-report-print .attendance-archive-panel{gap:10px}
      .attendance-report-print .attendance-archive-report{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .attendance-report-print .attendance-archive-report div{padding:10px 12px}
      .attendance-report-print .attendance-archive-button,
      .attendance-report-print .attendance-button{display:none !important}
      .attendance-report-print .student-attendance-table button{display:none !important}
      .attendance-report-print .student-attendance-table{font-size:10px}
      .attendance-report-print .student-attendance-table td,
      .attendance-report-print .student-attendance-table th{padding:5px 4px;font-size:10px}
      .attendance-report-print .student-attendance-table th{background:#eef4ff!important}
      .attendance-report-print .student-attendance-name{font-weight:700}
      .attendance-report-print .form-message{padding:8px 10px;font-size:12px;border:1px solid #d1d5db;background:#f8fafc}
    `
      : "@page{size:A4 landscape;margin:8mm}body{margin:8mm}";
  const html =
    '<!doctype html><html dir="' +
    document.documentElement.dir +
    '" lang="' +
    document.documentElement.lang +
    '"><head><meta charset="utf-8"><title>' +
    title +
    "</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:16px;line-height:1.6;color:#111827;background:#fff}h1{text-align:center;margin:0 0 14px;font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:auto}th,td{border:1px solid #555;padding:4px;text-align:center;vertical-align:top;white-space:normal;color:#111827}th{background:#eef4ff!important;font-weight:700}.table-wrap{overflow:visible!important;border:0!important;box-shadow:none!important}.daily-grid-table,.compact-table{min-width:0!important;width:100%!important}.teacher-program-card{page-break-inside:avoid;margin-bottom:10px;border:1px solid #999;padding:8px}.teacher-program-header{display:flex;justify-content:space-between;gap:8px}.teacher-program-summary{display:flex;gap:6px;flex-wrap:wrap}.teacher-lesson-cell{display:grid;gap:3px}.old-teacher{text-decoration:line-through}.new-teacher{font-weight:700}.export-notice{break-inside:avoid;page-break-inside:avoid}" +
    specialPrintStyles +
    "</style></head><body><h1>" +
    title +
    "</h1>" +
    noticeHtml +
    el.outerHTML +
    "</body></html>";

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeTitle + ".html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
