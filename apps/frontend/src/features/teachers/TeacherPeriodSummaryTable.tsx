import type { Translate } from "./teacherTypes";

type Props = {
  t: Translate;
  lessonsToday: number;
  substitutionsToday: number;
  affectedToday: number;
};

export function TeacherPeriodSummaryTable({ t, lessonsToday, substitutionsToday, affectedToday }: Props) {
  return (
    <div className="table-wrap small-table">
      <table>
        <thead>
          <tr>
            <th>{t("common.status")}</th>
            <th>{t("teachers.todayLessons")}</th>
            <th>{t("teachers.todaySubstitutions")}</th>
            <th>{t("teachers.affectionToday")}</th>
          </tr>
        </thead>
        <tbody>
          {[t("common.day"), t("common.weekly"), t("common.monthly"), t("common.termly"), t("common.yearly")].map(
            (period) => (
              <tr key={period}>
                <td>{period}</td>
                <td>{lessonsToday}</td>
                <td>{substitutionsToday}</td>
                <td>{affectedToday}</td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
