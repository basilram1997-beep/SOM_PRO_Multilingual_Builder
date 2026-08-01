import { localizeClassName, localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { HomeroomAssignment, HomeroomClass, HomeroomTeacher } from "./homeroomTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  classes: HomeroomClass[];
  teachers: HomeroomTeacher[];
  homeroomFor: (classId: string) => HomeroomAssignment | undefined;
  teacherIdFromClassName: (className: string) => string;
  selectedClassIds: string[];
  onToggleClass: (classId: string) => void;
  onRemove: (id?: string) => void;
};

export function HomeroomAssignmentsTable(props: Props) {
  const {
    t,
    language,
    classes,
    teachers,
    homeroomFor,
    teacherIdFromClassName,
    selectedClassIds,
    onToggleClass,
    onRemove
  } = props;
  return (
    <div className="table-wrap homeroom-table-wrap">
      <table className="homeroom-table">
        <thead>
          <tr>
            <th>{t("teachers.select")}</th>
            <th>{t("common.class")}</th>
            <th>{t("common.teacher")}</th>
            <th>{t("common.day")}</th>
            <th>{t("common.period")}</th>
            <th>{t("common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {classes.map((cls) => {
            const assignment = homeroomFor(cls.id);
            const classTeacherName =
              teachers.find((teacher) => teacher.id === teacherIdFromClassName(cls.name))?.name || "";
            return (
              <tr key={cls.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedClassIds.includes(cls.id)}
                    onChange={() => onToggleClass(cls.id)}
                  />
                </td>
                <td>{localizeClassName(cls.name, language)}</td>
                <td
                  className="teacher-color-cell"
                  style={teacherColorStyle(
                    assignment?.teacher?.name
                      ? { name: assignment.teacher.name }
                      : classTeacherName
                        ? { name: classTeacherName }
                        : null
                  )}
                >
                  {assignment?.teacher?.name
                    ? localizeTeacherName(assignment.teacher.name, language)
                    : classTeacherName
                      ? localizeTeacherName(classTeacherName, language)
                      : t("common.notSet")}
                </td>
                <td>{assignment?.weeklyDay ? localizeDay(assignment.weeklyDay, language) : t("common.notSet")}</td>
                <td>{assignment?.weeklyPeriod || t("common.notSet")}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="light danger"
                    disabled={!assignment?.id}
                    onClick={() => onRemove(assignment?.id)}
                  >
                    {t("common.delete")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
