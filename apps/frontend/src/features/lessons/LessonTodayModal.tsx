import { X } from "lucide-react";
import { localizeDay, localizeSubjectName, localizeClassName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { AuthUser } from "../../pages/auth/LoginPage";
import type { LessonTodayForm, LessonTodayTeacher } from "./lessonTodayTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  currentUser: AuthUser;
  teachers: LessonTodayTeacher[];
  selectedTeacherId: string;
  classOptions: Array<{ id: string; name: string }>;
  subjectOptions: Array<{ id: string; name: string }>;
  day: string;
  form: LessonTodayForm;
  saving: boolean;
  isTeacher: boolean;
  selectedTeacherName: string;
  onChange: (form: LessonTodayForm) => void;
  onSelectTeacher: (id: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function LessonTodayModal({
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
      <div className="modal-card lesson-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header lesson-modal-header">
          <div>
            <h3>{t("lessonToday.modalTitle")}</h3>
            <p>{selectedTeacherName}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta lesson-meta">
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
                <option value="">{t("lessonToday.selectTeacher")}</option>
                {teachers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="student-form-row lesson-row lesson-row--three lesson-core-fields">
          <label>
            {t("common.class")}
            <select value={form.classId} onChange={(event) => onChange({ ...form, classId: event.target.value })}>
              <option value="">{t("lessonToday.selectClass")}</option>
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
              <option value="">{t("lessonToday.selectSubject")}</option>
              {subjectOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeSubjectName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.period")}
            <input
              type="number"
              min={1}
              max={12}
              value={form.period}
              onChange={(event) => onChange({ ...form, period: Number(event.target.value) || 1 })}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--two lesson-summary-row">
          <label className="lesson-summary-field">
            {t("lessonToday.summaryField")}
            <textarea
              rows={4}
              value={form.summary || ""}
              onChange={(event) => onChange({ ...form, summary: event.target.value })}
              placeholder={t("lessonToday.summaryPlaceholder")}
            />
          </label>
          <div className="lesson-summary-side">
            <div className="lesson-status-caption">{t("lessonToday.status")}</div>
            <div className="lesson-status-toggle">
              <button
                type="button"
                className={
                  form.status === "NOT_STARTED" ? "tone-toggle tone-negative active" : "tone-toggle tone-negative"
                }
                onClick={() => onChange({ ...form, status: "NOT_STARTED" })}
              >
                {t("lessonToday.status.NOT_STARTED")}
              </button>
              <button
                type="button"
                className={
                  form.status === "IN_PROGRESS" ? "tone-toggle tone-positive active" : "tone-toggle tone-positive"
                }
                onClick={() => onChange({ ...form, status: "IN_PROGRESS" })}
              >
                {t("lessonToday.status.IN_PROGRESS")}
              </button>
              <button
                type="button"
                className={
                  form.status === "COMPLETED" ? "tone-toggle tone-completed active" : "tone-toggle tone-completed"
                }
                onClick={() => onChange({ ...form, status: "COMPLETED" })}
              >
                {t("lessonToday.status.COMPLETED")}
              </button>
            </div>
            <p className="lesson-status-note">{t("lessonToday.statusNote")}</p>
          </div>
        </div>

        <div className="student-form-row lesson-row">
          <label>
            {t("lessonToday.titleField")}
            <input
              value={form.title}
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder={t("lessonToday.titlePlaceholder")}
            />
          </label>
        </div>

        <div className="student-form-row lesson-row lesson-row--two">
          <label>
            {t("lessonToday.noteField")}
            <textarea
              rows={3}
              value={form.note || ""}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
            />
          </label>
          <label>
            {t("lessonToday.attachmentsField")}
            <textarea
              rows={3}
              value={form.attachments || ""}
              onChange={(event) => onChange({ ...form, attachments: event.target.value })}
              placeholder={t("lessonToday.attachmentsPlaceholder")}
            />
          </label>
        </div>

        <div className="lesson-assignment-hint">
          {teacher && availableClassNames.length > 0 ? (
            <span>{t("lessonToday.teacherHint")}</span>
          ) : (
            <span>{t("lessonToday.noTeacherAssignments")}</span>
          )}
        </div>

        <div className="button-group lesson-modal-actions">
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("lessonToday.saving") : t("common.save")}
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
