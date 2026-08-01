import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeSubjectName, localizeTeacherName } from "../../i18n/displayNames";
import { substitutionKindLabel } from "./dailyHelpers";
import { teacherColorStyle } from "../../utils/teacherColors";
import type { AppLanguage, DailySubstitution, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  substitutions: DailySubstitution[];
  onExport: () => void;
  onOpenSubstitution: (substitution: DailySubstitution) => void;
};

export function SubstitutionsTable({ t, language, substitutions, onExport, onOpenSubstitution }: Props) {
  return (
    <Card
      actions={
        <button className="secondary" onClick={onExport}>
          {t("daily.exportSubstitutions")}
        </button>
      }
    >
      <div className="table-wrap" id="daily-substitutions-section">
        <table>
          <thead>
            <tr>
              <th>{t("common.period")}</th>
              <th>{t("common.class")}</th>
              <th>{t("common.subject")}</th>
              <th>{t("daily.affectedTeacher")}</th>
              <th>{t("daily.substitute")}</th>
              <th>{t("daily.substitutionKind")}</th>
            </tr>
          </thead>
          <tbody>
            {substitutions.length === 0 && (
              <tr>
                <td colSpan={6}>{t("daily.noSubstitutions")}</td>
              </tr>
            )}
            {substitutions.map((substitution) => (
              <tr key={substitution.id} data-e2e={`daily-substitution-row-${substitution.id}`}>
                <td>{substitution.period}</td>
                <td>{substitution.class?.name ? localizeClassName(substitution.class.name, language) : "-"}</td>
                <td>{substitution.subject?.name ? localizeSubjectName(substitution.subject.name, language) : "-"}</td>
                <td className="teacher-color-cell" style={teacherColorStyle(substitution.absentTeacher)}>
                  {substitution.absentTeacher?.name
                    ? localizeTeacherName(substitution.absentTeacher.name, language)
                    : "-"}
                </td>
                <td
                  data-e2e={`daily-substitution-edit-${substitution.id}`}
                  className="clickable-cell teacher-color-cell"
                  style={teacherColorStyle(substitution.substituteTeacher)}
                  onClick={() => onOpenSubstitution(substitution)}
                >
                  {substitution.substituteTeacher?.name
                    ? localizeTeacherName(substitution.substituteTeacher.name, language)
                    : t("daily.noSubstitute")}
                </td>
                <td>{substitutionKindLabel(substitution.kind || "", t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
