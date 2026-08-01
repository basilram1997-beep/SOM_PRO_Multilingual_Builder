import { X } from "lucide-react";
import { localizeDay } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import type { AcademicRow, StudentAcademicForm } from "./studentTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  row: AcademicRow;
  form: StudentAcademicForm;
  day: string;
  selectedClassName: string;
  selectedSubjectName: string;
  saving: boolean;
  onChange: (form: StudentAcademicForm) => void;
  onSave: () => void;
  onClose: () => void;
};

export function AcademicRecordModal({
  t,
  language,
  row,
  form,
  day,
  selectedClassName,
  selectedSubjectName,
  saving,
  onChange,
  onSave,
  onClose
}: Props) {
  return (
    <div className="modal-backdrop academic-modal-backdrop" onClick={onClose}>
      <div className="modal-card academic-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header academic-modal-header">
          <div>
            <h3>{t("academic.modalTitle")}</h3>
            <p>
              {row.name} / {selectedClassName} / {selectedSubjectName}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta">
          <span>
            <strong>{t("common.date")}:</strong> {form.date}
          </span>
          <span>
            <strong>{t("common.day")}:</strong> {localizeDay(day, language)}
          </span>
        </div>

        <div className="academic-tone-toggle">
          <button
            type="button"
            className={form.tone === "POSITIVE" ? "tone-toggle tone-positive active" : "tone-toggle tone-positive"}
            onClick={() => onChange({ ...form, tone: "POSITIVE" })}
          >
            {t("academic.positive")}
          </button>
          <button
            type="button"
            className={form.tone === "NEGATIVE" ? "tone-toggle tone-negative active" : "tone-toggle tone-negative"}
            onClick={() => onChange({ ...form, tone: "NEGATIVE" })}
          >
            {t("academic.negative")}
          </button>
        </div>

        <div className="student-form-row student-form-row--three academic-row">
          <label>
            {t("academic.strengths")}
            <textarea
              rows={3}
              value={form.strengths || ""}
              onChange={(event) => onChange({ ...form, strengths: event.target.value })}
            />
          </label>
          <label>
            {t("academic.weaknesses")}
            <textarea
              rows={3}
              value={form.weaknesses || ""}
              onChange={(event) => onChange({ ...form, weaknesses: event.target.value })}
            />
          </label>
          <label>
            {t("academic.assignments")}
            <textarea
              rows={3}
              value={form.assignments || ""}
              onChange={(event) => onChange({ ...form, assignments: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row student-form-row--two academic-row">
          <label>
            {t("academic.lessonProgress")}
            <textarea
              rows={3}
              value={form.lessonProgress || ""}
              onChange={(event) => onChange({ ...form, lessonProgress: event.target.value })}
            />
          </label>
          <label>
            {t("academic.certificate")}
            <textarea
              rows={3}
              value={form.certificate || ""}
              onChange={(event) => onChange({ ...form, certificate: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row academic-row">
          <label>
            {t("academic.note")}
            <textarea
              rows={4}
              value={form.note || ""}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
            />
          </label>
        </div>

        <div className="button-group academic-modal-actions">
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("academic.saving") : t("common.save")}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
