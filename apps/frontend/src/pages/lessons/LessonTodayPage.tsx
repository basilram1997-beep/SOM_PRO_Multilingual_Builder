import { Card } from "../../components/ui/Card";
import { localizeSubjectName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { LessonTodayModal } from "../../features/lessons/LessonTodayModal";
import { LessonTodayTable } from "../../features/lessons/LessonTodayTable";
import { useLessonToday } from "../../features/lessons/useLessonToday";

type Props = {
  currentUser: AuthUser;
};

export function LessonTodayPage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const lesson = useLessonToday(currentUser);
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const showLessonMessage = lesson.message && !/FORBIDDEN|forbidden/i.test(lesson.message);

  return (
    <div className="page lesson-today-page">
      <h2>
        {isStudentViewer
          ? t("nav.studentLessonToday")
          : currentUser.role === "TEACHER"
            ? t("nav.teacherLessonToday")
            : t("lessonToday.title")}
      </h2>

      {showLessonMessage && (
        <div className="form-message" role="status">
          {lesson.message}
        </div>
      )}

      <Card>
        <div className="attendance-controls lesson-controls lesson-subject-filter">
          <label className="lesson-subject-filter-label">
            {t("common.subject")}
            <select
              value={lesson.selectedSubjectId}
              onChange={(event) => lesson.setSelectedSubjectId(event.target.value)}
            >
              <option value="">{t("lessonToday.selectSubject")}</option>
              {lesson.subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card title={t("lessonToday.summaryTitle")}>
        <div className="attendance-summary lesson-summary">
          <div className="attendance-summary-card">
            <span>{t("lessonToday.total")}</span>
            <strong>{lesson.summary.total}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-absent">
            <span>{t("lessonToday.notStarted")}</span>
            <strong>{lesson.summary.notStarted}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-late">
            <span>{t("lessonToday.inProgress")}</span>
            <strong>{lesson.summary.inProgress}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-present">
            <span>{t("lessonToday.completed")}</span>
            <strong>{lesson.summary.completed}</strong>
          </div>
        </div>
      </Card>

      <LessonTodayTable
        t={t}
        language={language}
        rows={lesson.visibleRows}
        loading={lesson.loading}
        savingLessonId={lesson.savingLessonId}
        onEdit={lesson.openEditor}
        onDelete={lesson.removeLesson}
        readOnly={isStudentViewer}
      />

      {!isStudentViewer && (
        <Card
          title={t("lessonToday.newLessonTitle")}
          actions={
            <button type="button" onClick={() => lesson.openEditor()}>
              {t("lessonToday.add")}
            </button>
          }
        >
          {null}
        </Card>
      )}

      {!isStudentViewer && lesson.editingLesson !== null && (
        <LessonTodayModal
          t={t}
          language={language}
          currentUser={currentUser}
          teachers={lesson.teachers}
          selectedTeacherId={lesson.selectedTeacherId}
          classOptions={lesson.classOptions}
          subjectOptions={lesson.subjectOptions}
          day={lesson.day}
          form={lesson.form}
          saving={
            lesson.savingLessonId ===
            (lesson.form.id || `${lesson.form.classId}-${lesson.form.subjectId}-${lesson.form.period}`)
          }
          isTeacher={lesson.isTeacher}
          selectedTeacherName={lesson.selectedTeacher?.name || t("lessonToday.selectTeacher")}
          onChange={lesson.setForm}
          onSelectTeacher={lesson.setSelectedTeacherId}
          onSave={lesson.saveLesson}
          onClose={lesson.closeEditor}
        />
      )}
    </div>
  );
}
