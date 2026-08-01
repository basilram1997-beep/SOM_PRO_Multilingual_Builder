import { Card } from "../../components/ui/Card";
import type { LanguageCode } from "../../i18n/i18n";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import type { HomeworkPreparationRow } from "./homeworkPreparationTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  rows: HomeworkPreparationRow[];
  loading: boolean;
  savingHomeworkId: string | null;
  onEdit: (homework: HomeworkPreparationRow) => void;
  onDelete: (id: string) => void;
  onSubmissions: (homework: HomeworkPreparationRow) => void;
  readOnly?: boolean;
};

export function HomeworkPreparationTable({
  t,
  language,
  rows,
  loading,
  savingHomeworkId,
  onEdit,
  onDelete,
  onSubmissions,
  readOnly = false
}: Props) {
  return (
    <Card title={t("homework.listTitle")}>
      <div className="table-wrap lesson-table-wrap">
        <table className="lesson-table">
          <thead>
            <tr>
              <th>{t("common.date")}</th>
              <th>{t("common.class")}</th>
              <th>{t("common.subject")}</th>
              <th>{t("homework.kind")}</th>
              <th>{t("homework.titleField")}</th>
              <th>{t("homework.dueDate")}</th>
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
                <td colSpan={readOnly ? 6 : 7}>{t("homework.empty")}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>{localizeClassName(row.class.name ?? "", language)}</td>
                  <td>{localizeSubjectName(row.subject.name ?? "", language)}</td>
                  <td>{t(`homework.kind.${row.kind}`)}</td>
                  <td>{row.title}</td>
                  <td>{row.dueDate || "-"}</td>
                  {!readOnly && (
                    <td className="row-actions">
                      <button
                        type="button"
                        className="light"
                        disabled={savingHomeworkId === row.id}
                        onClick={() => onEdit(row)}
                      >
                        {t("common.edit")}
                      </button>
                      <button
                        type="button"
                        className="light"
                        disabled={savingHomeworkId === row.id}
                        onClick={() => onSubmissions(row)}
                      >
                        {t("homework.submissions")}
                      </button>
                      <button
                        type="button"
                        className="danger light"
                        disabled={savingHomeworkId === row.id}
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
