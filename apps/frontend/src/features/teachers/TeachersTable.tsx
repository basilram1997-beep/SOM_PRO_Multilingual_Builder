import { localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import { effectiveLoad, preferredClassText } from "./teacherHelpers";
import type { AppLanguage, TeacherWithAssignments, Translate } from "./teacherTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  filtered: TeacherWithAssignments[];
  selected: TeacherWithAssignments | null;
  schoolClasses: { id: string; name: string }[];
  query: string;
  day: string;
  workingDays: string[];
  lessonsToday: (teacherId?: string) => number;
  weeklyLessons: (teacherId?: string) => number;
  substitutionsToday: (teacherId?: string) => number;
  onQueryChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onOpenTeacher: (teacher: TeacherWithAssignments) => void;
  onRemove: (id?: string, name?: string) => void;
  onAddTeacher: () => void;
  onEditSelected: () => void;
  onDeleteSelected: () => void;
};

export function TeachersTable(props: Props) {
  const {
    t,
    language,
    filtered,
    selected,
    schoolClasses,
    query,
    day,
    workingDays,
    lessonsToday,
    weeklyLessons,
    substitutionsToday
  } = props;
  const employeeNumberLabel =
    language === "ar" ? "رقم الموظف" : language === "he" ? "מספר עובד" : t("teachers.employeeNumber");
  const effectiveLoadLabel =
    language === "ar" ? "العبء الفعلي" : language === "he" ? "עומס אפקטיבי" : t("teachers.effectiveLoad");
  const teacherSearchPlaceholder =
    language === "ar"
      ? "ابحث عن معلم أو صف أو تخصص..."
      : language === "he"
        ? "חפש מורה, כיתה או התמחות..."
        : t("teachers.searchPlaceholder");

  return (
    <>
      <div className="teacher-list-toolbar">
        <input
          className="search wide-input"
          placeholder={teacherSearchPlaceholder}
          value={query}
          onChange={(e) => props.onQueryChange(e.target.value)}
        />
        <label>
          {t("common.day")}
          <select value={day} onChange={(e) => props.onDayChange(e.target.value)}>
            {workingDays.map((d) => (
              <option key={d} value={d}>
                {localizeDay(d, language)}
              </option>
            ))}
          </select>
        </label>
        <div className="teacher-list-toolbar-actions">
          <button onClick={props.onAddTeacher}>{t("teachers.add")}</button>
          <button className="secondary" onClick={props.onEditSelected}>
            {t("teachers.editSelected")}
          </button>
          <button className="danger" onClick={props.onDeleteSelected}>
            {t("teachers.deleteSelected")}
          </button>
        </div>
      </div>
      <div className="table-wrap teachers-table-wrap">
        <table className="wide-table">
          <thead>
            <tr>
              <th>{t("teachers.select")}</th>
              <th>{t("teachers.name")}</th>
              <th>{employeeNumberLabel}</th>
              <th>{t("teachers.adminRole")}</th>
              <th>{t("teachers.employmentRatio")}</th>
              <th>{t("teachers.releaseHours")}</th>
              <th>{t("teachers.targetLoad")}</th>
              <th>{effectiveLoadLabel}</th>
              <th>{t("teachers.weeklyLessons")}</th>
              <th>{t("teachers.specialty")}</th>
              <th>{t("teachers.classes")}</th>
              <th>{t("teachers.todayLessons")}</th>
              <th>{t("teachers.todaySubstitutions")}</th>
              <th>{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((teacher) => (
              <tr
                key={teacher.id}
                className={selected?.id === teacher.id ? "selected" : ""}
                onClick={() => props.onOpenTeacher(teacher)}
              >
                <td>
                  <input
                    type="radio"
                    checked={selected?.id === teacher.id}
                    onChange={() => props.onOpenTeacher(teacher)}
                  />
                </td>
                <td>{localizeTeacherName(teacher.name, language)}</td>
                <td>{teacher.employeeNumber || "-"}</td>
                <td>{teacher.adminRole || "-"}</td>
                <td>{teacher.employmentRatio ?? 100}%</td>
                <td>{teacher.releaseHours || 0}</td>
                <td>{teacher.targetLoad || 25}</td>
                <td>{effectiveLoad(teacher)}</td>
                <td className={weeklyLessons(teacher.id) > effectiveLoad(teacher) ? "load-over" : "load-ok"}>
                  {weeklyLessons(teacher.id)}
                </td>
                <td>{teacher.specialty || "-"}</td>
                <td>{preferredClassText(teacher, schoolClasses, language) || "-"}</td>
                <td>{lessonsToday(teacher.id)}</td>
                <td>{substitutionsToday(teacher.id)}</td>
                <td className="row-actions">
                  <button
                    className="light"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onOpenTeacher(teacher);
                    }}
                  >
                    {t("teachers.editSelected")}
                  </button>
                  <button
                    className="danger light"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onRemove(teacher.id, teacher.name);
                    }}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
