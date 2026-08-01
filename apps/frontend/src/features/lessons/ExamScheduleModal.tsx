import { X } from "lucide-react";
import { localizeClassName, localizeDay, localizeSubjectName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { AuthUser } from "../../pages/auth/LoginPage";
import type { ExamScheduleForm, ExamScheduleTeacher } from "./examScheduleTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  currentUser: AuthUser;
  teachers: ExamScheduleTeacher[];
  selectedTeacherId: string;
  classOptions: Array<{ id: string; name: string }>;
  subjectOptions: Array<{ id: string; name: string }>;
  day: string;
  form: ExamScheduleForm;
  saving: boolean;
  isTeacher: boolean;
  selectedTeacherName: string;
  onChange: (form: ExamScheduleForm) => void;
  onSelectTeacher: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function ExamScheduleModal({
  t,
  language,
  currentUser,
  teachers,
  selectedTeacherId,
  classOptions,
  subjectOptions,
  day,
  form,
  saving,
  isTeacher,
  selectedTeacherName,
  onChange,
  onSelectTeacher,
  onSave,
  onClose
}: Props) {
  const teacher = teachers.find((item) => item.id === selectedTeacherId) || null;

  return (
    <div className="modal-backdrop lesson-modal-backdrop" onClick={onClose}>
      <div className="modal-card lesson-modal exam-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header lesson-modal-header">
          <div>
            <h3>{t("exams.modalTitle")}</h3>
            <p>{selectedTeacherName}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta lesson-meta exam-meta">
          <span>
            <strong>{t("common.date")}:</strong> {form.date}
          </span>
          <span>
            <strong>{t("common.day")}:</strong> {localizeDay(day, language)}
          </span>
          <span>
            <strong>{t("common.teacher")}:</strong> {selectedTeacherName}
          </span>
        </div>

        {!isTeacher && (
          <div className="student-form-row lesson-row lesson-row--one">
            <label>
              {t("common.teacher")}
              <select value={selectedTeacherId} onChange={(event) => onSelectTeacher(event.target.value)}>
                <option value="">{t("exams.selectTeacher")}</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="student-form-row lesson-row lesson-row--three exam-row">
          <label>
            {t("common.class")}
            <select value={form.classId} onChange={(event) => onChange({ ...form, classId: event.target.value })}>
              <option value="">{t("exams.selectClass")}</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.subject")}
            <select value={form.subjectId} onChange={(event) => onChange({ ...form, subjectId: event.target.value })}>
              <option value="">{t("exams.selectSubject")}</option>
              {subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("exams.nameField")}
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder={t("exams.namePlaceholder")}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--three exam-row">
          <label>
            {t("exams.startTime")}
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => onChange({ ...form, startTime: event.target.value })}
            />
          </label>
          <label>
            {t("exams.endTime")}
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => onChange({ ...form, endTime: event.target.value })}
            />
          </label>
          <label>
            {t("exams.room")}
            <input
              value={form.room || ""}
              onChange={(event) => onChange({ ...form, room: event.target.value })}
              placeholder={t("exams.roomPlaceholder")}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--two exam-row">
          <label>
            {t("exams.instructions")}
            <textarea
              rows={4}
              value={form.instructions || ""}
              onChange={(event) => onChange({ ...form, instructions: event.target.value })}
              placeholder={t("exams.instructionsPlaceholder")}
            />
          </label>
          <label>
            {t("exams.notes")}
            <textarea
              rows={4}
              value={form.notes || ""}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
              placeholder={t("exams.notesPlaceholder")}
            />
          </label>
        </div>

        <div className="lesson-assignment-hint">
          {teacher && teacher.assignments.length > 0 ? (
            <span>{t("exams.teacherHint")}</span>
          ) : (
            <span>{t("exams.noTeacherAssignments")}</span>
          )}
        </div>

        <div className="button-group lesson-modal-actions">
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("exams.saving") : t("common.save")}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t("common.close")}
          </button>
        </div>

        {isTeacher && <p className="lesson-user-note">{currentUser.name}</p>}
      </div>
    </div>
  );
}
