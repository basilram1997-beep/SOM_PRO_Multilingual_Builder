import { Card } from "../../components/ui/Card";
import { localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import type { DutyAssignment, Teacher } from "@som/shared";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  form: DutyAssignment;
  teachers: Teacher[];
  workingDays: string[];
  saving: boolean;
  message: string;
  onChange: (next: DutyAssignment) => void;
  onSave: () => void;
  onReset: () => void;
};

export function DutyEditorForm({
  t,
  language,
  form,
  teachers,
  workingDays,
  saving,
  message,
  onChange,
  onSave,
  onReset
}: Props) {
  return (
    <Card title={form.id ? t("duties.editTitle") : t("duties.addTitle")}>
      <div className="form duty-form">
        <div className="duty-form-row duty-form-row--primary">
          <label>
            {t("common.day")}
            <select value={form.day} onChange={(e) => onChange({ ...form, day: e.target.value })}>
              {workingDays.map((day) => (
                <option key={day} value={day}>
                  {localizeDay(day, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("duties.startTime")}
            <input
              type="time"
              value={form.startTime}
              onChange={(e) => onChange({ ...form, startTime: e.target.value })}
            />
          </label>
          <label>
            {t("duties.endTime")}
            <input type="time" value={form.endTime} onChange={(e) => onChange({ ...form, endTime: e.target.value })} />
          </label>
        </div>

        <div className="duty-form-row duty-form-row--secondary">
          <label>
            {t("duties.place")}
            <input
              value={form.place}
              onChange={(e) => onChange({ ...form, place: e.target.value })}
              placeholder={t("duties.placePlaceholder")}
            />
          </label>
          <label>
            {t("common.teacher")}
            <select value={form.teacherId} onChange={(e) => onChange({ ...form, teacherId: e.target.value })}>
              <option value="">{t("duties.selectTeacher")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {localizeTeacherName(teacher.name, language)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="duty-form-row duty-form-row--details">
          <label>
            {t("common.details")}
            <textarea value={form.notes || ""} onChange={(e) => onChange({ ...form, notes: e.target.value })} />
          </label>
          <div className="duty-form-footer">
            <label className="inline-check">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => onChange({ ...form, isActive: e.target.checked })}
              />
              {t("duties.active")}
            </label>
            <div className="actions">
              <button type="button" onClick={onSave} disabled={saving}>
                {saving ? t("users.saving") : t("common.save")}
              </button>
              <button type="button" className="secondary" onClick={onReset}>
                {t("common.clear")}
              </button>
            </div>
          </div>
        </div>
      </div>
      {message && <div className="success">{message}</div>}
    </Card>
  );
}
