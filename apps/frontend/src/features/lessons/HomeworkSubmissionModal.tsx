import { X } from "lucide-react";
import { localizeClassName, localizeSubjectName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type {
  HomeworkPreparationRow,
  HomeworkPreparationStudent,
  HomeworkSubmissionForm
} from "./homeworkPreparationTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  homework: HomeworkPreparationRow;
  students: HomeworkPreparationStudent[];
  form: HomeworkSubmissionForm[];
  loading: boolean;
  saving: boolean;
  onChange: (studentId: string, patch: Partial<HomeworkSubmissionForm>) => void;
  onSave: () => void;
  onClose: () => void;
};

export function HomeworkSubmissionModal({
  t,
  language,
  homework,
  students,
  form,
  loading,
  saving,
  onChange,
  onSave,
  onClose
}: Props) {
  const solved = form.filter((item) => item.status === "SOLVED").length;
  const unsolved = form.filter((item) => item.status === "UNSOLVED").length;
  const late = form.filter((item) => item.status === "LATE").length;

  return (
    <div className="modal-backdrop lesson-modal-backdrop" onClick={onClose}>
      <div
        className="modal-card lesson-modal homework-modal homework-submissions-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header lesson-modal-header">
          <div>
            <h3>{t("homework.submissionsModalTitle")}</h3>
            <p>{homework.title}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta lesson-meta homework-meta">
          <span>
            <strong>{t("common.class")}:</strong> {localizeClassName(homework.class.name, language)}
          </span>
          <span>
            <strong>{t("common.subject")}:</strong> {localizeSubjectName(homework.subject.name, language)}
          </span>
          <span>
            <strong>{t("homework.kind")}:</strong> {t(`homework.kind.${homework.kind}`)}
          </span>
        </div>

        <div className="attendance-summary homework-summary">
          <div className="attendance-summary-card">
            <span>{t("homework.total")}</span>
            <strong>{students.length}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-present">
            <span>{t("homework.statusSolved")}</span>
            <strong>{solved}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-late">
            <span>{t("homework.statusLate")}</span>
            <strong>{late}</strong>
          </div>
          <div className="attendance-summary-card attendance-summary-absent">
            <span>{t("homework.statusUnsolved")}</span>
            <strong>{unsolved}</strong>
          </div>
        </div>

        <div className="table-wrap homework-submission-wrap">
          <table className="homework-submission-table">
            <thead>
              <tr>
                <th>{t("students.name")}</th>
                <th>{t("homework.studentStatus")}</th>
                <th>{t("homework.grade")}</th>
                <th>{t("homework.note")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={4}>{t("common.loading")}</td>
                </tr>
              )}
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={4}>{t("homework.noStudents")}</td>
                </tr>
              )}
              {!loading &&
                students.map((student) => {
                  const submission = form.find((item) => item.studentId === student.id);
                  return (
                    <tr key={student.id}>
                      <td className="homework-student-name">{student.name}</td>
                      <td>
                        <div className="homework-status-buttons">
                          <button
                            type="button"
                            className={
                              submission?.status === "SOLVED"
                                ? "tone-toggle tone-positive active"
                                : "tone-toggle tone-positive"
                            }
                            onClick={() => onChange(student.id, { status: "SOLVED" })}
                          >
                            {t("homework.statusSolved")}
                          </button>
                          <button
                            type="button"
                            className={
                              submission?.status === "UNSOLVED"
                                ? "tone-toggle tone-negative active"
                                : "tone-toggle tone-negative"
                            }
                            onClick={() => onChange(student.id, { status: "UNSOLVED" })}
                          >
                            {t("homework.statusUnsolved")}
                          </button>
                          <button
                            type="button"
                            className={
                              submission?.status === "LATE"
                                ? "tone-toggle tone-completed active"
                                : "tone-toggle tone-completed"
                            }
                            onClick={() => onChange(student.id, { status: "LATE" })}
                          >
                            {t("homework.statusLate")}
                          </button>
                        </div>
                      </td>
                      <td>
                        <input
                          value={submission?.grade || ""}
                          onChange={(event) => onChange(student.id, { grade: event.target.value })}
                          placeholder={t("homework.gradePlaceholder")}
                        />
                      </td>
                      <td>
                        <textarea
                          rows={2}
                          value={submission?.note || ""}
                          onChange={(event) => onChange(student.id, { note: event.target.value })}
                          placeholder={t("homework.notePlaceholder")}
                        />
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        <div className="button-group lesson-modal-actions">
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("homework.savingSubmissions") : t("homework.saveSubmissions")}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
