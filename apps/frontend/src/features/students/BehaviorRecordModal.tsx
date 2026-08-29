import { X } from "lucide-react";
import { localizeDay } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";
import { behaviorCategories, getBehaviorCategory, getBehaviorCategoryLabelKey, getBehaviorTemplates } from "./behaviorTemplates";
import type { BehaviorRow, StudentBehaviorForm } from "./studentTypes";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  row: BehaviorRow;
  form: StudentBehaviorForm;
  day: string;
  selectedClassName: string;
  saving: boolean;
  canUndo: boolean;
  onChange: (form: StudentBehaviorForm) => void;
  onSelectCategory: (category: string) => void;
  onSelectTone: (tone: "POSITIVE" | "NEGATIVE") => void;
  onUndo: () => void;
  onSave: () => void;
  onClose: () => void;
};

export function BehaviorRecordModal({
  t,
  language,
  row,
  form,
  day,
  selectedClassName,
  saving,
  canUndo,
  onChange,
  onSelectCategory,
  onSelectTone,
  onUndo,
  onSave,
  onClose
}: Props) {
  const category = getBehaviorCategory(form.category || behaviorCategories[0].key);
  const templates = getBehaviorTemplates(category.key, form.tone);

  return (
    <div className="modal-backdrop behavior-modal-backdrop" onClick={onClose}>
      <div className="modal-card behavior-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header behavior-modal-header">
          <div>
            <h3>{t("behavior.modalTitle")}</h3>
            <p>
              {row.name} / {selectedClassName}
            </p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t("common.close")}>
            <X size={18} />
          </button>
        </div>

        <div className="academic-meta behavior-meta">
          <span>
            <strong>{t("common.date")}:</strong> {form.date}
          </span>
          <span>
            <strong>{t("common.day")}:</strong> {localizeDay(day, language)}
          </span>
        </div>

        <div className="academic-tone-toggle behavior-tone-toggle">
          <button
            type="button"
            className={form.tone === "POSITIVE" ? "tone-toggle tone-positive active" : "tone-toggle tone-positive"}
            onClick={() => onSelectTone("POSITIVE")}
          >
            {t("behavior.positive")}
          </button>
          <button
            type="button"
            className={form.tone === "NEGATIVE" ? "tone-toggle tone-negative active" : "tone-toggle tone-negative"}
            onClick={() => onSelectTone("NEGATIVE")}
          >
            {t("behavior.negative")}
          </button>
        </div>
        <p className="behavior-tone-hint">{t("behavior.toneHint")}</p>

        <div className="behavior-category-grid">
          {behaviorCategories.map((item) => (
            <button
              key={item.key}
              type="button"
              className={form.category === item.key ? "behavior-category-card active" : "behavior-category-card"}
              onClick={() => onSelectCategory(item.key)}
            >
              <strong>{t(item.labelKey)}</strong>
            </button>
          ))}
        </div>

        <div className="behavior-template-section">
          <div className="behavior-template-title">
            <strong>{t("behavior.templatesTitle")}</strong>
            <span>{t(category.labelKey)}</span>
          </div>
          <div className="behavior-template-grid">
            {templates.map((template) => (
              <button
                key={template}
                type="button"
                className={form.template === template ? "behavior-template-chip active" : "behavior-template-chip"}
                onClick={() => onChange({ ...form, template })}
              >
                {template}
              </button>
            ))}
          </div>
        </div>

        <div className="student-form-row behavior-row">
          <label>
            {t("behavior.template")}
            <textarea
              rows={4}
              value={form.template}
              onChange={(event) => onChange({ ...form, template: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row behavior-row">
          <label>
            {t("behavior.note")}
            <textarea
              rows={4}
              value={form.note || ""}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
            />
          </label>
        </div>

        {row.behaviorRecords.length > 0 && (
          <div className="behavior-existing-block">
            <strong>{t("behavior.existingNotes")}</strong>
            <div className="behavior-existing-list">
              {row.behaviorRecords.map((record) => (
                <article key={record.id || `${record.category}-${record.tone}-${record.template}`}>
                  <span>{t(getBehaviorCategoryLabelKey(record.category)) || record.category}</span>
                  <strong>{record.tone === "POSITIVE" ? t("behavior.positive") : t("behavior.negative")}</strong>
                  <p>{record.template}</p>
                  {record.note && <small>{record.note}</small>}
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="button-group behavior-modal-actions">
          <button type="button" className="secondary" onClick={onUndo} disabled={saving || !canUndo}>
            {t("behavior.undo")}
          </button>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? t("behavior.saving") : t("common.save")}
          </button>
          <button type="button" className="secondary" onClick={onClose} disabled={saving}>
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
