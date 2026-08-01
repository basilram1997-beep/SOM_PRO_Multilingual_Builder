import { Card } from "../../components/ui/Card";
import type { LanguageCode } from "../../i18n/i18n";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import type { ExamScheduleRow } from "./examScheduleTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  rows: ExamScheduleRow[];
  loading: boolean;
  savingExamId: string | null;
  onEdit: (exam: ExamScheduleRow) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
};

export function ExamScheduleTable({
  t,
  language,
  rows,
  loading,
  savingExamId,
  onEdit,
  onDelete,
  readOnly = false
}: Props) {
  return (
    <Card title={t("exams.listTitle")}>
      <div className="table-wrap lesson-table-wrap">
        <table className="lesson-table exam-table">
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("common.class")}</th>
              <th>{t("common.subject")}</th>
              <th>{t("exams.nameField")}</th>
              <th>{t("exams.timeRange")}</th>
              <th>{t("exams.room")}</th>
              <th>{t("exams.responsibleTeacher")}</th>
              <th>{t("exams.conflict")}</th>
              {!readOnly && <th>{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={readOnly ? 8 : 9}>{t("common.loading")}</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 8 : 9}>{t("exams.empty")}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id} className={row.hasConflict ? "exam-conflict-row" : ""}>
                  <td>{row.date}</td>
                  <td>{localizeClassName(row.class.name ?? "", language)}</td>
                  <td>{localizeSubjectName(row.subject.name ?? "", language)}</td>
                  <td>
                    <div className="exam-name-cell">
                      <strong>{row.title}</strong>
                      {row.instructions ? <span>{row.instructions}</span> : null}
                    </div>
                  </td>
                  <td>{`${row.startTime} - ${row.endTime}`}</td>
                  <td>{row.room || "-"}</td>
                  <td>{row.teacher.name}</td>
                  <td>
                    {row.hasConflict ? (
                      <span className="exam-conflict-badge">
                        {t("exams.conflictBadge")} ({row.conflictCount})
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  {!readOnly && (
                    <td className="row-actions">
                      <button
                        type="button"
                        className="light"
                        disabled={savingExamId === row.id}
                        onClick={() => onEdit(row)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="danger light"
                        disabled={savingExamId === row.id}
                        onClick={() => onDelete(row.id)}
                      >
                        {t("common.delete")}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
