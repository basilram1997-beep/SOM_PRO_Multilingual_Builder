import { Card } from "../../components/ui/Card";
import { localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import type { DutyRow } from "./dutiesTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  rows: DutyRow[];
  readOnly?: boolean;
  onEdit: (row: DutyRow) => void;
  onDelete: (id?: string) => void;
};

export function DutiesTable({ t, language, rows, readOnly, onEdit, onDelete }: Props) {
  return (
    <Card title={t("duties.tableTitle")}>
      <div className="table-wrap duties-table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t("common.day")}</th>
              <th>{t("duties.time")}</th>
              <th>{t("duties.place")}</th>
              <th>{t("common.teacher")}</th>
              <th>{t("common.details")}</th>
              <th>{t("duties.status")}</th>
              {!readOnly && <th>{t("common.actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={readOnly ? 6 : 7}>{t("duties.empty")}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className={!row.isActive ? "muted-row" : ""}>
                <td>{localizeDay(row.day, language)}</td>
                <td>
                  {row.startTime} - {row.endTime}
                </td>
                <td>{row.place}</td>
                <td className="teacher-color-cell" style={teacherColorStyle(row.teacher)}>
                  {row.teacher?.name ? localizeTeacherName(row.teacher.name, language) : "-"}
                </td>
                <td>{row.notes || "-"}</td>
                <td>{row.isActive ? t("duties.active") : t("duties.inactive")}</td>
                {!readOnly && (
                  <td className="row-actions">
                    <button className="light" onClick={() => onEdit(row)}>
                      {t("common.edit")}
                    </button>
                    <button className="danger light" onClick={() => onDelete(row.id)}>
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
