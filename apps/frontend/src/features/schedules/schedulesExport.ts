import { buildExportNotice, recordExportAction, type ExportNotice } from "../exports/exportAudit";

async function recordScheduleExport(sectionId: string, title: string, fileName: string) {
  if (sectionId !== "base-schedule-grid") return null;

  const lang = document.documentElement.lang;
  const privacyWarning =
    lang === "he"
      ? "הייצוא הזה פרטי ומוגבל בזמן."
      : lang === "en"
        ? "This export is private and expires automatically."
        : "هذا التصدير خاص ومؤقت وينتهي تلقائيًا بعد فترة قصيرة.";

  try {
    const result = await recordExportAction({
      page: "schedules",
      title,
      fileName,
      kind: "PDF",
      permission: "manageSchedules",
      expiresInMinutes: 15
    });
    return buildExportNotice(privacyWarning, result.expiresAt);
  } catch {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return buildExportNotice(privacyWarning, expiresAt);
  }
}

export async function exportSectionPdf(sectionId: string, title: string, notice?: ExportNotice) {
  const el = document.getElementById(sectionId);
  if (!el) return alert("تعذر العثور على الجدول المطلوب تصديره");

  const safeTitle = title.replace(/[\\/:*?"<>|]+/g, "-").trim() || "som-pro-export";
  const exportNotice = notice || (await recordScheduleExport(sectionId, title, `${safeTitle}.html`));
  const noticeHtml = exportNotice
    ? `<div class="export-notice" style="border:1px solid #cbd5e1;background:#eff6ff;padding:8px 10px;margin:0 0 12px;border-radius:10px;font-size:11px;line-height:1.5;color:#0f172a"><strong style="display:block;margin-bottom:4px">${exportNotice.privacyWarning}</strong><span>Generated: ${exportNotice.generatedAt}</span><br /><span>Expires: ${exportNotice.expiresAt}</span></div>`
    : "";
  const html = `<!doctype html><html dir="${document.documentElement.dir}" lang="${document.documentElement.lang}"><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:16px;line-height:1.6;color:#111827;background:#fff}h1{text-align:center;margin:0 0 14px;font-size:18px}table{width:100%;border-collapse:collapse;font-size:10px;table-layout:auto}th,td{border:1px solid #555;padding:4px;text-align:center;vertical-align:top;white-space:normal;color:#111827}th{background:#eef4ff!important;font-weight:700}.table-wrap{overflow:visible!important;border:0!important;box-shadow:none!important}.daily-grid-table,.compact-table{min-width:0!important;width:100%!important}.teacher-program-card{page-break-inside:avoid;margin-bottom:10px;border:1px solid #999;padding:8px}.teacher-program-header{display:flex;justify-content:space-between;gap:8px}.teacher-program-summary{display:flex;gap:6px;flex-wrap:wrap}.teacher-lesson-cell{display:grid;gap:3px}.old-teacher{text-decoration:line-through}.new-teacher{font-weight:700}.export-notice{break-inside:avoid;page-break-inside:avoid}@page{size:A4 landscape;margin:8mm}body{margin:8mm}</style></head><body><h1>${title}</h1>${noticeHtml}${el.outerHTML}</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeTitle}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
