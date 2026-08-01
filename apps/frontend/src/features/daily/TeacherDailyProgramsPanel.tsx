import { Card } from "../../components/ui/Card";
import { localizeClassName, localizeSubjectName, localizeTeacherName } from "../../i18n/displayNames";
import { lessonClass, lessonTypeLabel } from "./dailyHelpers";
import type { AppLanguage, TeacherProgram, Translate } from "./dailyTypes";

type Props = {
  t: Translate;
  language: AppLanguage;
  readOnly?: boolean;
  periods: number[];
  teacherPrograms: TeacherProgram[];
  visibleTeacherPrograms: TeacherProgram[];
  teacherSearch: string;
  showOnlyBusyTeachers: boolean;
  loadingTeacherPrograms: boolean;
  onGenerate: () => void;
  onExport: () => void;
  onTeacherSearchChange: (value: string) => void;
  onShowOnlyBusyTeachersChange: (value: boolean) => void;
};

export function TeacherDailyProgramsPanel(props: Props) {
  const {
    t,
    language,
    readOnly,
    periods,
    teacherPrograms,
    visibleTeacherPrograms,
    teacherSearch,
    showOnlyBusyTeachers,
    loadingTeacherPrograms
  } = props;
  return (
    <Card
      actions={
        !readOnly ? (
          <div className="actions">
            <button type="button" onClick={props.onGenerate} disabled={loadingTeacherPrograms}>
              {loadingTeacherPrograms ? t("daily.generating") : t("daily.generateTeacherPrograms")}
            </button>
            {teacherPrograms.length > 0 && (
              <button type="button" className="secondary" onClick={props.onExport}>
                {t("daily.exportTeacherPrograms")}
              </button>
            )}
          </div>
        ) : undefined
      }
    >
      {!readOnly && teacherPrograms.length > 0 && (
        <div className="teacher-program-controls no-print">
          <input
            placeholder={t("daily.searchTeacher")}
            value={teacherSearch}
            onChange={(e) => props.onTeacherSearchChange(e.target.value)}
          />
          <label className="inline-check">
            <input
              type="checkbox"
              checked={showOnlyBusyTeachers}
              onChange={(e) => props.onShowOnlyBusyTeachersChange(e.target.checked)}
            />
            {t("daily.showBusyOnly")}
          </label>
          <span className="pill">
            {t("daily.visible")}: {visibleTeacherPrograms.length}
          </span>
        </div>
      )}
      <div className="teacher-programs-print-area" id="teacher-programs-section">
        {teacherPrograms.length === 0 && (
          <div className="empty-state">
            {readOnly ? t("teacherPortal.noPersonalProgram") : t("daily.emptyTeacherPrograms")}
          </div>
        )}
        {visibleTeacherPrograms.map((program) => (
          <TeacherProgramCard key={program.teacherId} program={program} periods={periods} t={t} language={language} />
        ))}
      </div>
    </Card>
  );
}

function TeacherProgramCard({
  program,
  periods,
  t,
  language
}: {
  program: TeacherProgram;
  periods: number[];
  t: Translate;
  language: AppLanguage;
}) {
  const lessonsByPeriod = new Map<number, TeacherProgram["lessons"][number]>();
  program.lessons.forEach((lesson) => lessonsByPeriod.set(lesson.period, lesson));
  return (
    <section className="teacher-program-card">
      <div className="teacher-program-header">
        <div>
          <h3>{localizeTeacherName(program.teacherName, language)}</h3>
          <p>{program.specialty || t("daily.noSpecialty")}</p>
        </div>
        <div className="teacher-program-summary">
          <span>
            {t("daily.originalLessons")}: {program.totalOriginalLessons}
          </span>
          <span>
            {t("daily.substitutionsCount")}: {program.totalSubstitutions}
          </span>
          <span>
            {t("daily.total")}: {program.totalLessons}
          </span>
        </div>
      </div>
      {program.status && (
        <div className="teacher-status-note">
          {t("daily.todayStatus")}: {program.status}
        </div>
      )}
      <div className="table-wrap">
        <table className="compact-table">
          <thead>
            <tr>
              {periods.map((p) => (
                <th key={p}>
                  {t("common.period")} {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {periods.map((period) => {
                const lesson = lessonsByPeriod.get(period);
                return (
                  <td key={period} className={lesson ? lessonClass(lesson.lessonType) : "free-period"}>
                    {lesson ? (
                      <div className="teacher-lesson-cell">
                        <strong>{localizeClassName(lesson.className, language)}</strong>
                        <span>{localizeSubjectName(lesson.subjectName, language)}</span>
                        <em>
                          {lessonTypeLabel(
                            lesson.lessonType,
                            lesson.substituteForName
                              ? localizeTeacherName(lesson.substituteForName, language)
                              : lesson.substituteForName,
                            t
                          )}
                        </em>
                      </div>
                    ) : (
                      <span className="muted">{t("daily.free")}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
