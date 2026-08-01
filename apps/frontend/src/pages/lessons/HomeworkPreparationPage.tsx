import { Card } from "../../components/ui/Card";
import { localizeSubjectName } from "../../i18n/displayNames";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { HomeworkPreparationModal } from "../../features/lessons/HomeworkPreparationModal";
import { HomeworkPreparationTable } from "../../features/lessons/HomeworkPreparationTable";
import { HomeworkSubmissionModal } from "../../features/lessons/HomeworkSubmissionModal";
import { useHomeworkPreparation } from "../../features/lessons/useHomeworkPreparation";

type Props = {
  currentUser: AuthUser;
};

export function HomeworkPreparationPage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const homework = useHomeworkPreparation(currentUser);
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const showHomeworkMessage = homework.message && !/FORBIDDEN|forbidden/i.test(homework.message);

  return (
    <div className="page lesson-today-page homework-page">
      <h2>
        {isStudentViewer
          ? t("nav.studentHomeworkPreparation")
          : currentUser.role === "TEACHER"
            ? t("nav.teacherHomework")
            : t("homework.title")}
      </h2>

      <Card>
        <div className="attendance-controls lesson-controls lesson-subject-filter">
          <label className="lesson-subject-filter-label">
            {t("common.subject")}
            <select
              value={homework.selectedSubjectId}
              onChange={(event) => homework.setSelectedSubjectId(event.target.value)}
            >
              <option value="">{t("homework.selectSubject")}</option>
              {homework.subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showHomeworkMessage && (
          <div className="form-message" role="status">
            {homework.message}
          </div>
        )}
      </Card>

      <Card title={t("homework.summaryTitle")}>
        <div className="attendance-summary lesson-summary">
          <div className="attendance-summary-card">
            <span>{t("homework.total")}</span>
            <strong>{homework.summary.total}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-present">
            <span>{t("homework.kind.HOMEWORK")}</span>
            <strong>{homework.summary.homework}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-late">
            <span>{t("homework.kind.PREPARATION")}</span>
            <strong>{homework.summary.preparation}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-absent">
            <span>{t("homework.listCount")}</span>
            <strong>{homework.rows.length}</strong>
          </div>
        </div>
        <p className="attendance-summary-note" aria-live="polite">
          {homework.teacherAssignments.length > 0
            ? homework.teacherAssignments.map((item) => `${item.className} / ${item.subjectName}`).join(" • ")
            : t("homework.noTeacherAssignments")}
        </p>
      </Card>

      <HomeworkPreparationTable
        t={t}
        language={language}
        rows={homework.visibleRows}
        loading={homework.loading}
        savingHomeworkId={homework.savingHomeworkId}
        onEdit={homework.openEditor}
        onDelete={homework.removeHomework}
        onSubmissions={homework.openSubmissions}
        readOnly={isStudentViewer}
      />

      {!isStudentViewer && (
        <Card
          title={t("homework.newHomeworkTitle")}
          actions={
            <button type="button" onClick={() => homework.openEditor()}>
              {t("homework.add")}
            </button>
          }
        >
          {null}
        </Card>
      )}

      {!isStudentViewer && homework.editingHomework !== null && (
        <HomeworkPreparationModal
          t={t}
          language={language}
          currentUser={currentUser}
          teachers={homework.teachers}
          selectedTeacherId={homework.selectedTeacherId}
          classOptions={homework.classOptions}
          subjectOptions={homework.subjectOptions}
          day={homework.day}
          form={homework.form}
          saving={
            homework.savingHomeworkId ===
            (homework.form.id || `${homework.form.classId}-${homework.form.subjectId}-${homework.form.kind}`)
          }
          isTeacher={homework.isTeacher}
          selectedTeacherName={homework.selectedTeacher?.name || t("homework.selectTeacher")}
          onChange={homework.setForm}
          onSelectTeacher={homework.setSelectedTeacherId}
          onSave={homework.saveHomework}
          onClose={homework.closeEditor}
        />
      )}

      {!isStudentViewer && homework.submissionsHomework && (
        <HomeworkSubmissionModal
          t={t}
          language={language}
          homework={homework.submissionsHomework}
          students={homework.selectedHomeworkStudents}
          form={homework.submissionForm}
          loading={homework.submissionsLoading}
          saving={homework.submissionsSaving}
          onChange={homework.updateSubmission}
          onSave={homework.saveSubmissions}
          onClose={homework.closeSubmissions}
        />
      )}
    </div>
  );
}
