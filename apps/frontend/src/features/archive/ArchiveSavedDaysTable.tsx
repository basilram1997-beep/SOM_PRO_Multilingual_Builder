import { localizeDay } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import { substitutionKindLabel } from "../../features/daily/dailyHelpers";
import { exportArchiveFile } from "./archiveExport";
import type { ArchiveRow, ArchiveSnapshot } from "./archiveTypes";

type Props = {
  items: ArchiveRow[];
  t: (key: string) => string;
  language: AppLanguage;
  onEditDay: (date: string) => void;
  onDeleteDay: (date: string) => void;
};

function uniqueStrings(values: Array<string | number | null | undefined>) {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function periodSort(a: string, b: string) {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isNaN(left) && !Number.isNaN(right)) return left - right;
  return a.localeCompare(b, "ar");
}

function statusTypeLabel(type: string, t: (key: string) => string) {
  if (type === "ABSENT") return t("daily.absent");
  if (type === "LATE") return t("daily.late");
  if (type === "LEFT") return t("daily.left");
  if (type === "UNAVAILABLE") return t("daily.mission");
  return type || t("common.none");
}

function countByLabel<T>(rows: T[], selector: (row: T) => string) {
  return rows.reduce((map, row) => {
    const key = selector(row);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map<string, number>());
}

function renderCountList(entries: Array<[string, number]>, emptyText: string) {
  if (!entries.length) return emptyText;
  return entries.map(([label, count]) => `${label} ${count}`).join("، ");
}

function buildStatusTypeSummary(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const statuses = snapshot.statuses || item.statuses || [];
  const counts = Array.from(countByLabel(statuses, (status) => status.type || t("common.none")).entries()).map(
    ([type, count]) => [statusTypeLabel(type, t), count] as [string, number]
  );
  return renderCountList(counts, t("common.empty"));
}

function buildSubstitutionTypeSummary(snapshot: ArchiveSnapshot, item: ArchiveRow, t: (key: string) => string) {
  const substitutions = snapshot.substitutions || item.substitutions || [];
  const counts = Array.from(countByLabel(substitutions, (sub) => sub.kind || t("common.none")).entries()).map(
    ([kind, count]) => [substitutionKindLabel(kind, t), count] as [string, number]
  );
  return renderCountList(counts, t("common.empty"));
}

function buildAffectedClasses(snapshot: ArchiveSnapshot, item: ArchiveRow) {
  const classes = snapshot.affectedClasses || [];
  const substitutions = snapshot.substitutions || item.substitutions || [];
  return (
    uniqueStrings([...classes.map((row) => row.name), ...substitutions.map((sub) => sub.class?.name)]).join("، ") || "-"
  );
}

function buildAffectedSubjects(snapshot: ArchiveSnapshot, item: ArchiveRow) {
  const substitutions = snapshot.substitutions || item.substitutions || [];
  const modifiedSlots = snapshot.dailyModifiedSlots || [];
  return (
    uniqueStrings([
      ...substitutions.map((sub) => sub.subject?.name),
      ...modifiedSlots.map((slot) => slot.subjectName)
    ]).join("، ") || "-"
  );
}

function buildAffectedPeriods(snapshot: ArchiveSnapshot, item: ArchiveRow) {
  const substitutions = snapshot.substitutions || item.substitutions || [];
  const modifiedSlots = snapshot.dailyModifiedSlots || [];
  return (
    uniqueStrings([...substitutions.map((sub) => sub.period), ...modifiedSlots.map((slot) => slot.period)])
      .sort(periodSort)
      .join("، ") || "-"
  );
}

function getDateText(item: ArchiveRow, snapshot: ArchiveSnapshot, language: AppLanguage) {
  return new Date(snapshot.archivedAt || item.updatedAt || item.date).toLocaleString(language);
}

export function ArchiveSavedDaysTable({ items, t, language, onEditDay, onDeleteDay }: Props) {
  return (
    <div className="archive-list">
      {items.length === 0 && <div className="empty-state">{t("common.empty")}</div>}

      <div className="archive-table-wrap">
        <table className="archive-table">
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("common.day")}</th>
              <th>{t("archive.statusCount")}</th>
              <th>{t("archive.statusTypes")}</th>
              <th>{t("archive.substitutionCount")}</th>
              <th>{t("archive.substitutionTypes")}</th>
              <th>{t("archive.affectedClasses")}</th>
              <th>{t("archive.affectedSubjects")}</th>
              <th>{t("archive.affectedPeriods")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const snapshot = item.archiveSnapshot || {};
              const statuses = snapshot.statuses || item.statuses || [];
              const substitutions = snapshot.substitutions || item.substitutions || [];
              const statusCount = snapshot.statusSummary
                ? (snapshot.statusSummary.absent || 0) +
                  (snapshot.statusSummary.late || 0) +
                  (snapshot.statusSummary.left || 0) +
                  (snapshot.statusSummary.unavailable || 0)
                : statuses.length;
              const substitutionCount = snapshot.report?.totalSubstitutions ?? substitutions.length;
              const archivedAt = getDateText(item, snapshot, language);

              return (
                <tr key={item.id} data-e2e={`archive-row-${item.date}`}>
                  <td>
                    <strong>{item.date}</strong>
                    <div className="archive-cell-subtext">{archivedAt}</div>
                  </td>
                  <td>{localizeDay(item.day, language)}</td>
                  <td>
                    <strong>{statusCount}</strong>
                  </td>
                  <td>
                    <div className="archive-cell-list">{buildStatusTypeSummary(snapshot, item, t)}</div>
                  </td>
                  <td>
                    <strong>{substitutionCount}</strong>
                  </td>
                  <td>
                    <div className="archive-cell-list">{buildSubstitutionTypeSummary(snapshot, item, t)}</div>
                  </td>
                  <td>
                    <div className="archive-cell-list">{buildAffectedClasses(snapshot, item)}</div>
                  </td>
                  <td>
                    <div className="archive-cell-list">{buildAffectedSubjects(snapshot, item)}</div>
                  </td>
                  <td>
                    <div className="archive-cell-list">{buildAffectedPeriods(snapshot, item)}</div>
                  </td>
                  <td>
                    <div className="archive-row-actions">
                      <button type="button" className="secondary" onClick={() => onEditDay(item.date)}>
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => {
                          if (window.confirm(`${t("common.delete")} ${item.date}؟`)) onDeleteDay(item.date);
                        }}
                      >
                        {t("common.delete")}
                      </button>
                      <button
                        type="button"
                        className="secondary light"
                        onClick={() => void exportArchiveFile(item, t, language)}
                      >
                        {t("archive.exportFull")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
