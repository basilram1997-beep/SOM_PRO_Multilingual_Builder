import { Card } from "../../components/ui/Card";
import type { LanguageCode } from "../../i18n/i18n";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import type { LessonTodayRow } from "./lessonTodayTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  rows: LessonTodayRow[];
  loading: boolean;
  savingLessonId: string | null;
  onEdit: (lesson: LessonTodayRow) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
};

export function LessonTodayTable({
  t,
  language,
  rows,
  loading,
  savingLessonId,
  onEdit,
  onDelete,
  readOnly = false
}: Props) {
  return (
    <Card title={t("lessonToday.listTitle")}>
      <div className="table-wrap lesson-table-wrap">
        <table className="lesson-table">
          <thead>
            <tr>
              <th className="lesson-period-column">{t("common.period")}</th>
              <th>{t("common.class")}</th>
              <th>{t("common.subject")}</th>
              <th>{t("lessonToday.titleField")}</th>
              <th>{t("lessonToday.status")}</th>
              <th>{t("lessonToday.summaryField")}</th>
              {!readOnly && <th>{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={readOnly ? 6 : 7}>{t("common.loading")}</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7}>{t("lessonToday.empty")}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="lesson-period-column">{row.period}</td>
                  <td>{localizeClassName(row.class.name ?? "", language)}</td>
                  <td>{localizeSubjectName(row.subject.name ?? "", language)}</td>
                  <td>{row.title}</td>
                  <td>{t(`lessonToday.status.${row.status}`)}</td>
                  <td>{row.summary || "-"}</td>
                  {!readOnly && (
                    <td className="row-actions">
                      <button
                        type="button"
                        className="light"
                        disabled={savingLessonId === row.id}
                        onClick={() => onEdit(row)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="danger light"
                        disabled={savingLessonId === row.id}
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
