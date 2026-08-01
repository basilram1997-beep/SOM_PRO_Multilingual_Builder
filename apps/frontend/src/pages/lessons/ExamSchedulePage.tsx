import { Card } from "../../components/ui/Card";
import { useI18n } from "../../i18n/i18n";
import type { AuthUser } from "../auth/LoginPage";
import { ExamScheduleModal } from "../../features/lessons/ExamScheduleModal";
import { ExamScheduleTable } from "../../features/lessons/ExamScheduleTable";
import { useExamSchedule } from "../../features/lessons/useExamSchedule";

type Props = {
  currentUser: AuthUser;
};

export function ExamSchedulePage({ currentUser }: Props) {
  const { t, language } = useI18n();
  const examSchedule = useExamSchedule(currentUser);
  const isStudentViewer = currentUser.role === "STUDENT" || currentUser.role === "PARENT";
  const showExamMessage = examSchedule.message && !/FORBIDDEN|forbidden/i.test(examSchedule.message);
  const showExamWarning = examSchedule.warning && !/FORBIDDEN|forbidden/i.test(examSchedule.warning);

  return (
    <div className="page lesson-today-page exam-page">
      <h2>
        {isStudentViewer
          ? t("nav.studentExams")
          : currentUser.role === "TEACHER"
            ? t("nav.teacherExams")
            : t("exams.title")}
      </h2>

      {showExamMessage && (
        <div className="form-message" role="status">
          {examSchedule.message}
        </div>
      )}
      {showExamWarning && (
        <div className="form-message form-warning" role="alert">
          {examSchedule.warning}
        </div>
      )}

      <ExamScheduleTable
        t={t}
        language={language}
        rows={examSchedule.rows}
        loading={examSchedule.loading}
        savingExamId={examSchedule.savingExamId}
        onEdit={examSchedule.openEditor}
        onDelete={examSchedule.removeExam}
        readOnly={isStudentViewer}
      />

      {!isStudentViewer && (
        <Card
          title={t("exams.newExamTitle")}
          actions={
            <button type="button" onClick={() => examSchedule.openEditor()}>
              {t("exams.add")}
            </button>
          }
        >
          {null}
        </Card>
      )}

      {!isStudentViewer && examSchedule.editingExam !== null && (
        <ExamScheduleModal
          t={t}
          language={language}
          currentUser={currentUser}
          teachers={examSchedule.teachers}
          selectedTeacherId={examSchedule.selectedTeacherId}
          classOptions={examSchedule.classOptions}
          subjectOptions={examSchedule.subjectOptions}
          day={examSchedule.day}
          form={examSchedule.form}
          saving={
            examSchedule.savingExamId ===
            (examSchedule.form.id ||
              `${examSchedule.form.classId}-${examSchedule.form.subjectId}-${examSchedule.form.startTime}-${examSchedule.form.endTime}`)
          }
          isTeacher={examSchedule.isTeacher}
          selectedTeacherName={examSchedule.selectedTeacher?.name || t("exams.selectTeacher")}
          onChange={examSchedule.setForm}
          onSelectTeacher={examSchedule.setSelectedTeacherId}
          onSave={examSchedule.saveExam}
          onClose={examSchedule.closeEditor}
        />
      )}
    </div>
  );
}
