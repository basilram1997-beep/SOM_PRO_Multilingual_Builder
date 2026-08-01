import { Card } from "../../components/ui/Card";
import { localizeTeacherName } from "../../i18n/displayNames";
import type { AppLanguage, DailyTeacher, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  periods: number[];
  periodDisplay: (period: number) => { name: string; time?: string };
  freeTeachersForPeriod: (period: number) => DailyTeacher[];
  onExport?: () => void;
};

export function FreeTeachersPanel({ t, language, periods, periodDisplay, freeTeachersForPeriod, onExport }: Props) {
  return (
    <Card
      actions={
        onExport ? (
          <button type="button" className="secondary" onClick={onExport}>
            {t("daily.exportFreeTeachers")}
          </button>
        ) : null
      }
    >
      <div className="table-wrap free-teachers-table" id="daily-free-teachers-section">
        <table>
          <thead>
            <tr>
              <th>{t("common.period")}</th>
              <th>{t("daily.freeTeachers")}</th>
              <th>{t("daily.total")}</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const freeTeachers = freeTeachersForPeriod(period);
              return (
                <tr key={period}>
                  <td>{periodDisplay(period).name}</td>
                  <td>
                    {freeTeachers.length
                      ? freeTeachers.map((teacher) => localizeTeacherName(teacher.name, language)).join("، ")
                      : t("common.none")}
                  </td>
                  <td>{freeTeachers.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
