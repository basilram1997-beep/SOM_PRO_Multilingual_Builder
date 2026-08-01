import { X } from "lucide-react";
import { localizeClassName, localizeDay, localizeSubjectName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { AuthUser } from "../../pages/auth/LoginPage";
import type { HomeworkPreparationForm, HomeworkPreparationTeacher } from "./homeworkPreparationTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  currentUser: AuthUser;
  teachers: HomeworkPreparationTeacher[];
  selectedTeacherId: string;
  classOptions: Array<{ id: string; name: string }>;
  subjectOptions: Array<{ id: string; name: string }>;
  day: string;
  form: HomeworkPreparationForm;
  saving: boolean;
  isTeacher: boolean;
  selectedTeacherName: string;
  onChange: (form: HomeworkPreparationForm) => void;
  onSelectTeacher: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function HomeworkPreparationModal({
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
  const availableClassNames = teacher?.assignments || [];

  return (
    <div className="modal-backdrop lesson-modal-backdrop" onClick={onClose}>
      <div className="modal-card lesson-modal homework-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header lesson-modal-header">
          <div>
            <p>{selectedTeacherName}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta lesson-meta homework-meta">
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
                <option value="">{t("homework.selectTeacher")}</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="student-form-row lesson-row lesson-row--three homework-row">
          <label>
            {t("common.class")}
            <select value={form.classId} onChange={(event) => onChange({ ...form, classId: event.target.value })}>
              <option value="">{t("homework.selectClass")}</option>
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
              <option value="">{t("homework.selectSubject")}</option>
              {subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("homework.kind")}
            <select
              value={form.kind}
              onChange={(event) => onChange({ ...form, kind: event.target.value as "HOMEWORK" | "PREPARATION" })}
            >
              <option value="HOMEWORK">{t("homework.kind.HOMEWORK")}</option>
              <option value="PREPARATION">{t("homework.kind.PREPARATION")}</option>
            </select>
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--two homework-row">
          <label>
            {t("homework.titleField")}
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder={t("homework.titlePlaceholder")}
            />
          </label>
          <label>
            {t("homework.dueDate")}
            <input
              type="date"
              value={form.dueDate || ""}
              onChange={(event) => onChange({ ...form, dueDate: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--two homework-row">
          <label>
            {t("homework.descriptionField")}
            <textarea
              rows={4}
              value={form.description || ""}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder={t("homework.descriptionPlaceholder")}
            />
          </label>
          <label>
            {t("homework.attachmentField")}
            <textarea
              rows={4}
              value={form.attachment || ""}
              onChange={(event) => onChange({ ...form, attachment: event.target.value })}
              placeholder={t("homework.attachmentPlaceholder")}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row">
          <label>
            {t("homework.notesField")}
            <textarea
              rows={3}
              value={form.notes || ""}
              onChange={(event) => onChange({ ...form, notes: event.target.value })}
            />
          </label>
        </div>

        <div className="lesson-assignment-hint">
          {teacher && availableClassNames.length > 0 ? (
            <span>{t("homework.teacherHint")}</span>
          ) : (
            <span>{t("homework.noTeacherAssignments")}</span>
          )}
        </div>

        <div className="button-group lesson-modal-actions">
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("homework.saving") : t("common.save")}
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
