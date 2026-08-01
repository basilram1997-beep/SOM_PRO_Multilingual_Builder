import { Card } from "../../components/ui/Card";
import { localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import { teacherColorStyle } from "../../utils/teacherColors";
import { exportSectionPdf } from "./dailyHelpers";
import type { AppLanguage, DailyDuty, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  duties: DailyDuty[];
};

export function DailyDutiesPanel({ t, language, duties }: Props) {
  return (
    <Card
      title={t("duties.dailyTitle")}
      actions={
        <button
          type="button"
          className="secondary"
          onClick={() => void exportSectionPdf("daily-duties-section", t("duties.dailyTitle"))}
        >
          {t("common.exportPdf")}
        </button>
      }
    >
      <div className="table-wrap daily-duties-table" id="daily-duties-section">
        <table>
          <thead>
            <tr>
              <th>{t("common.day")}</th>
              <th>{t("duties.time")}</th>
              <th>{t("duties.place")}</th>
              <th>{t("common.teacher")}</th>
              <th>{t("duties.impact")}</th>
              <th>{t("common.details")}</th>
            </tr>
          </thead>
          <tbody>
            {duties.length === 0 && (
              <tr>
                <td colSpan={6}>{t("duties.noDailyDuties")}</td>
              </tr>
            )}
            {duties.map((duty) => (
              <tr key={duty.id} className={duty.affected ? "affected-duty-row" : ""}>
                <td>{localizeDay(duty.day, language)}</td>
                <td>
                  {duty.startTime} - {duty.endTime}
                </td>
                <td>{duty.place}</td>
                <td className="teacher-color-cell" style={teacherColorStyle(duty.teacher)}>
                  {duty.teacher?.name ? localizeTeacherName(duty.teacher.name, language) : "-"}
                </td>
                <td>
                  {duty.affected ? `${t("duties.affected")}: ${duty.affectedReason || ""}` : t("duties.notAffected")}
                </td>
                <td>{duty.notes || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
