import { localizeDay } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import { buildExportNotice, recordExportAction, type ExportNotice } from "../exports/exportAudit";
import type {
  ArchiveClass,
  ArchiveEvent,
  ArchiveFreeTeachersRow,
  ArchiveRow,
  ArchiveSnapshot,
  ArchiveStatus
} from "./archiveTypes";

function esc(value: unknown) {
  return String(value ?? "-").replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] || char
  );
}

function section(title: string, rows: string) {
  return "<h2>" + esc(title) + "</h2><table>" + rows + "</table>";
}

function countByType(statuses: ArchiveStatus[], type: string) {
  return statuses.filter((status) => status.type === type).length;
}

function joinTeacherNames(rows: ArchiveFreeTeachersRow[]) {
  return rows.map((row) => {
    const teachers = (row.teachers || [])
      .map((teacher) => teacher.name)
      .filter(Boolean)
      .join("، ");
    return { ...row, teachersText: teachers || "-" };
  });
}

function buildSummaryRows(
  snapshot: ArchiveSnapshot,
  item: ArchiveRow,
  language: AppLanguage,
  t: (key: string) => string
) {
  const date = snapshot.date || item.date;
  const day = snapshot.day || item.day;
  const statusSummary = snapshot.statusSummary || {};
  const statuses = snapshot.statuses || item.statuses || [];
  const substitutions = snapshot.substitutions || item.substitutions || [];
  const affectedClasses = snapshot.affectedClasses || [];

  return (
    "<tr><th>" +
    esc(t("common.date")) +
    "</th><td>" +
    esc(date) +
    "</td><th>" +
    esc(t("common.day")) +
    "</th><td>" +
    esc(localizeDay(day, language)) +
    "</td></tr>" +
    "<tr><th>" +
    esc(t("daily.absent")) +
    "</th><td>" +
    esc(statusSummary.absent ?? countByType(statuses, "ABSENT")) +
    "</td><th>" +
    esc(t("daily.late")) +
    "</th><td>" +
    esc(statusSummary.late ?? countByType(statuses, "LATE")) +
    "</td></tr>" +
    "<tr><th>" +
    esc(t("daily.left")) +
    "</th><td>" +
    esc(statusSummary.left ?? countByType(statuses, "LEFT")) +
    "</td><th>" +
    esc(t("daily.mission")) +
    "</th><td>" +
    esc(statusSummary.unavailable ?? countByType(statuses, "UNAVAILABLE")) +
    "</td></tr>" +
    "<tr><th>" +
    esc(t("archive.substitutions")) +
    "</th><td>" +
    esc(substitutions.length) +
    "</td><th>" +
    esc(t("archive.affectedClasses")) +
    "</th><td>" +
    esc(affectedClasses.length) +
    "</td></tr>"
  );
}

function buildStatusRows(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const statuses = snapshot.statuses || item.statuses || [];
  return (
    "<tr><th>" +
    esc(t("common.teacher")) +
    "</th><th>" +
    esc(t("common.status")) +
    "</th><th>" +
    esc(t("common.from")) +
    "</th><th>" +
    esc(t("common.to")) +
    "</th></tr>" +
    (statuses.length
      ? statuses
          .map(
            (status) =>
              "<tr><td>" +
              esc(status.teacher?.name) +
              "</td><td>" +
              esc(status.label || status.type) +
              "</td><td>" +
              esc(status.fromPeriod) +
              "</td><td>" +
              esc(status.toPeriod) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="4">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildBaseRows(snapshot: ArchiveSnapshot, t: (key: string) => string) {
  const baseSlots = snapshot.baseSlots || [];
  return (
    "<tr><th>" +
    esc(t("common.period")) +
    "</th><th>" +
    esc(t("common.class")) +
    "</th><th>" +
    esc(t("common.subject")) +
    "</th><th>" +
    esc(t("common.teacher")) +
    "</th></tr>" +
    (baseSlots.length
      ? baseSlots
          .map(
            (slot) =>
              "<tr><td>" +
              esc(slot.period) +
              "</td><td>" +
              esc(slot.className) +
              "</td><td>" +
              esc(slot.subjectName) +
              "</td><td>" +
              esc(slot.teacherName) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="4">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildModifiedRows(snapshot: ArchiveSnapshot, t: (key: string) => string) {
  const dailyModifiedSlots = snapshot.dailyModifiedSlots || [];
  return (
    "<tr><th>" +
    esc(t("common.period")) +
    "</th><th>" +
    esc(t("common.class")) +
    "</th><th>" +
    esc(t("common.subject")) +
    "</th><th>" +
    esc(t("common.teacher")) +
    "</th><th>" +
    esc(t("common.details")) +
    "</th></tr>" +
    (dailyModifiedSlots.length
      ? dailyModifiedSlots
          .map(
            (slot) =>
              '<tr class="' +
              (slot.changed ? "changed" : "") +
              '"><td>' +
              esc(slot.period) +
              "</td><td>" +
              esc(slot.className) +
              "</td><td>" +
              esc(slot.subjectName) +
              "</td><td>" +
              esc(slot.teacherName) +
              (slot.originalTeacherName && slot.originalTeacherName !== slot.teacherName
                ? " <small>(" + esc(slot.originalTeacherName) + ")</small>"
                : "") +
              "</td><td>" +
              esc(slot.note || slot.changeType || "-") +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="5">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildSubstitutionRows(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const substitutions = snapshot.substitutions || item.substitutions || [];
  return (
    "<tr><th>" +
    esc(t("common.period")) +
    "</th><th>" +
    esc(t("common.class")) +
    "</th><th>" +
    esc(t("common.subject")) +
    "</th><th>" +
    esc(t("daily.affectedTeacher")) +
    "</th><th>" +
    esc(t("daily.substitute")) +
    "</th></tr>" +
    (substitutions.length
      ? substitutions
          .map(
            (substitution) =>
              "<tr><td>" +
              esc(substitution.period) +
              "</td><td>" +
              esc(substitution.class?.name) +
              "</td><td>" +
              esc(substitution.subject?.name) +
              "</td><td>" +
              esc(substitution.absentTeacher?.name) +
              "</td><td>" +
              esc(substitution.substituteTeacher?.name || t("daily.noSubstitute")) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="5">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildFreeRows(snapshot: ArchiveSnapshot, t: (key: string) => string) {
  const freeTeachers = snapshot.freeTeachers || [];
  const rows = joinTeacherNames(freeTeachers);
  return (
    "<tr><th>" +
    esc(t("common.period")) +
    "</th><th>" +
    esc(t("archive.freeTeachers")) +
    "</th><th>" +
    esc(t("daily.total")) +
    "</th></tr>" +
    (rows.length
      ? rows
          .map(
            (row) =>
              "<tr><td>" +
              esc(row.period) +
              "</td><td>" +
              esc(row.teachersText) +
              "</td><td>" +
              esc(row.total) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="3">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildDutyRows(snapshot: ArchiveSnapshot, t: (key: string) => string) {
  const duties = snapshot.duties || [];
  return (
    "<tr><th>" +
    esc(t("duties.time")) +
    "</th><th>" +
    esc(t("duties.place")) +
    "</th><th>" +
    esc(t("common.teacher")) +
    "</th><th>" +
    esc(t("duties.impact")) +
    "</th></tr>" +
    (duties.length
      ? duties
          .map(
            (duty) =>
              "<tr><td>" +
              esc(duty.startTime) +
              " - " +
              esc(duty.endTime) +
              "</td><td>" +
              esc(duty.place) +
              "</td><td>" +
              esc(duty.teacher?.name) +
              "</td><td>" +
              esc(duty.affected ? duty.affectedReason : t("duties.notAffected")) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="4">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildAffectedRows(snapshot: ArchiveSnapshot, t: (key: string) => string) {
  const affectedClasses = snapshot.affectedClasses || [];
  return (
    "<tr><th>" +
    esc(t("common.class")) +
    "</th><th>" +
    esc(t("common.period")) +
    "</th><th>" +
    esc(t("common.details")) +
    "</th></tr>" +
    (affectedClasses.length
      ? affectedClasses
          .map(
            (row: ArchiveClass) =>
              "<tr><td>" +
              esc(row.name) +
              "</td><td>" +
              esc((row.periods || []).join(", ")) +
              "</td><td>" +
              esc((row.reasons || []).join(" / ")) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="3">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildEventRows(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const events = snapshot.events || item.events || [];
  return (
    "<tr><th>" +
    esc(t("daily.eventType")) +
    "</th><th>" +
    esc(t("common.from")) +
    "</th><th>" +
    esc(t("common.to")) +
    "</th><th>" +
    esc(t("common.details")) +
    "</th></tr>" +
    (events.length
      ? events
          .map(
            (event: ArchiveEvent) =>
              "<tr><td>" +
              esc(event.type) +
              "</td><td>" +
              esc(event.fromPeriod) +
              "</td><td>" +
              esc(event.toPeriod) +
              "</td><td>" +
              esc(event.note) +
              "</td></tr>"
          )
          .join("")
      : '<tr><td colspan="4">' + esc(t("common.empty")) + "</td></tr>")
  );
}

function buildReportRows(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const statuses = snapshot.statuses || item.statuses || [];
  const substitutions = snapshot.substitutions || item.substitutions || [];
  const duties = snapshot.duties || [];
  const affectedClasses = snapshot.affectedClasses || [];
  const report = snapshot.report || {};
  return (
    "<tr><th>" +
    esc(t("archive.statuses")) +
    "</th><td>" +
    esc(report.totalStatuses ?? statuses.length) +
    "</td><th>" +
    esc(t("archive.substitutions")) +
    "</th><td>" +
    esc(report.totalSubstitutions ?? substitutions.length) +
    "</td></tr>" +
    "<tr><th>" +
    esc(t("archive.affectedClasses")) +
    "</th><td>" +
    esc(report.affectedClasses ?? affectedClasses.length) +
    "</td><th>" +
    esc(t("archive.duties")) +
    "</th><td>" +
    esc(report.dutiesAffected ?? duties.filter((duty) => duty.affected).length) +
    "</td></tr>"
  );
}

async function recordArchiveExport(title: string) {
  const lang = document.documentElement.lang;
  const privacyWarning =
    lang === "he"
      ? "הייצוא הזה פרטי ומוגבל בזמן."
      : lang === "en"
        ? "This export is private and expires automatically."
        : "هذا التصدير خاص ومؤقت وينتهي تلقائياً بعد فترة قصيرة.";

  try {
    const result = await recordExportAction({
      page: "archive",
      title,
      fileName: `${title.replace(/[\\/:*?"<>|]+/g, "-")}.html`,
      kind: "HTML",
      permission: "manageSchedules",
      expiresInMinutes: 15
    });
    return buildExportNotice(privacyWarning, result.expiresAt);
  } catch {
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    return buildExportNotice(privacyWarning, expiresAt);
  }
}

export async function exportArchiveFile(
  item: ArchiveRow,
  t: (key: string) => string,
  language: AppLanguage,
  notice?: ExportNotice
) {
  const snapshot = item.archiveSnapshot || {};
  const date = snapshot.date || item.date;
  const title = t("archive.fullDailyFile") + " - " + date;
  const exportNotice = notice || (await recordArchiveExport(title));
  const noticeHtml = exportNotice
    ? '<div class="export-notice" style="border:1px solid #cbd5e1;background:#eff6ff;padding:8px 10px;margin:0 0 12px;border-radius:10px;font-size:11px;line-height:1.5;color:#0f172a"><strong style="display:block;margin-bottom:4px">' +
      esc(exportNotice.privacyWarning) +
      "</strong><span>Generated: " +
      esc(exportNotice.generatedAt) +
      "</span><br /><span>Expires: " +
      esc(exportNotice.expiresAt) +
      "</span></div>"
    : "";
  const html =
    "<!doctype html><html dir=" +
    "'" +
    document.documentElement.dir +
    "'" +
    " lang=" +
    "'" +
    document.documentElement.lang +
    "'" +
    "><head><meta charset=" +
    "'utf-8'" +
    "><title>" +
    esc(title) +
    "</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:16px;color:#111827;line-height:1.6}h1{text-align:center;font-size:20px}h2{font-size:15px;margin:18px 0 8px}table{width:100%;border-collapse:collapse;margin-bottom:12px;table-layout:auto}th,td{border:1px solid #555;padding:5px;text-align:center;vertical-align:top;font-size:11px}th{background:#eef4ff}.changed td{background:#fff7ed;font-weight:700}small{color:#64748b}.export-notice{break-inside:avoid;page-break-inside:avoid}@media print{@page{size:A4 landscape;margin:8mm}body{margin:8mm}}</style></head><body><h1>" +
    esc(title) +
    "</h1>" +
    noticeHtml +
    section(t("archive.fullDailyFile"), buildSummaryRows(snapshot, item, language, t)) +
    section(t("archive.statuses"), buildStatusRows(snapshot, item, t)) +
    section(t("schedules.title"), buildBaseRows(snapshot, t)) +
    section(t("daily.fullSchedule"), buildModifiedRows(snapshot, t)) +
    section(t("archive.substitutions"), buildSubstitutionRows(snapshot, item, t)) +
    section(t("archive.freeTeachers"), buildFreeRows(snapshot, t)) +
    section(t("archive.duties"), buildDutyRows(snapshot, t)) +
    section(t("archive.affectedClasses"), buildAffectedRows(snapshot, t)) +
    section(t("archive.events"), buildEventRows(snapshot, item, t)) +
    section(t("reports.title"), buildReportRows(snapshot, item, t)) +
    "</body></html>";

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = title.replace(/[\\/:*?"<>|]+/g, "-") + ".html";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
