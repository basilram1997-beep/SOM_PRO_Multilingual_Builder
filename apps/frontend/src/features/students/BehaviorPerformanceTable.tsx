import { Card } from "../../components/ui/Card";
import type { BehaviorRow } from "./studentTypes";

type Props = {
  t: (key: string) => string;
  rows: BehaviorRow[];
  loading: boolean;
  savingStudentId: string | null;
  onEdit: (student: BehaviorRow) => void;
  readOnly?: boolean;
};

function summarize(row: BehaviorRow) {
  return row.behaviorRecords.reduce(
    (acc, record) => {
      acc.total += 1;
      if (record.tone === "POSITIVE") acc.positive += 1;
      if (record.tone === "NEGATIVE") acc.negative += 1;
      return acc;
    },
    { total: 0, positive: 0, negative: 0 }
  );
}

export function BehaviorPerformanceTable({ t, rows, loading, savingStudentId, onEdit, readOnly = false }: Props) {
  return (
    <Card title={t("behavior.studentsTitle")}>
      <div className="table-wrap behavior-table-wrap">
        <table className="behavior-table">
          <thead>
            <tr>
              <th>{t("students.name")}</th>
              <th>{t("behavior.totalRecords")}</th>
              <th>{t("behavior.positive")}</th>
              <th>{t("behavior.negative")}</th>
              {!readOnly && <th>{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={readOnly ? 4 : 5}>{t("common.loading")}</td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 4 : 5}>{t("behavior.emptyClass")}</td>
              </tr>
            )}
            {!loading &&
              rows.map((row) => {
                const summary = summarize(row);
                const disabled = savingStudentId === row.id;
                return (
                  <tr key={row.id}>
                    <td className="behavior-student-name">{row.name}</td>
                    <td>{summary.total}</td>
                    <td>{summary.positive}</td>
                    <td>{summary.negative}</td>
                    {!readOnly && (
                      <td className="row-actions">
                        <button type="button" className="light" disabled={disabled} onClick={() => onEdit(row)}>
                          {summary.total > 0 ? t("behavior.edit") : t("behavior.add")}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
