import type { SchoolClass, Student } from "@som/shared";
import { Card } from "../../components/ui/Card";
import { localizeClassName } from "../../i18n/displayNames";
import type { LanguageCode } from "../../i18n/i18n";

type Props = {
  t: (key: string) => string;
  language: LanguageCode;
  classes: SchoolClass[];
  form: Student;
  saving: boolean;
  message: string;
  onChange: (student: Student) => void;
  onSave: () => void;
  onReset: () => void;
};

export function StudentEditorForm({ t, language, classes, form, saving, message, onChange, onSave, onReset }: Props) {
  const fatherNameLabel = language === "ar" ? "اسم الأب" : language === "he" ? "שם האב" : t("students.fatherName");
  const motherNameLabel = language === "ar" ? "اسم الأم" : language === "he" ? "שם האם" : t("students.motherName");
  const fatherPhoneLabel =
    language === "ar" ? "هاتف الأب" : language === "he" ? "טלפון האב" : t("students.fatherPhone");
  const motherPhoneLabel =
    language === "ar" ? "هاتف الأم" : language === "he" ? "טלפון האם" : t("students.motherPhone");
  const guardianPhoneLabel =
    language === "ar"
      ? "هاتف الوصي إن وجد"
      : language === "he"
        ? "טלפון האפוטרופוס אם קיים"
        : t("students.guardianPhone");
  const studentPhoneLabel =
    language === "ar" ? "هاتف الطالب" : language === "he" ? "טלפון התלמיד" : t("students.studentPhone");

  return (
    <Card title={form.id ? t("students.editTitle") : t("students.addTitle")}>
      <div className="form student-profile-form">
        <div className="student-form-row student-form-row--three">
          <label>
            {t("students.name")}
            <input
              data-e2e="student-form-name"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            {t("students.nationalId")}
            <input
              data-e2e="student-form-national-id"
              value={form.nationalId || ""}
              onChange={(event) => onChange({ ...form, nationalId: event.target.value })}
            />
          </label>
          <label>
            {t("common.class")}
            <select
              data-e2e="student-form-class"
              value={form.classId}
              onChange={(event) => onChange({ ...form, classId: event.target.value })}
            >
              <option value="">{t("students.selectClass")}</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {localizeClassName(item.name, language)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="student-form-row student-form-row--two">
          <label>
            {fatherNameLabel}
            <input
              data-e2e="student-form-father-name"
              value={form.fatherName || ""}
              onChange={(event) => onChange({ ...form, fatherName: event.target.value })}
            />
          </label>
          <label>
            {motherNameLabel}
            <input
              data-e2e="student-form-mother-name"
              value={form.motherName || ""}
              onChange={(event) => onChange({ ...form, motherName: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row student-form-row--three">
          <label>
            {t("students.residence")}
            <input
              data-e2e="student-form-residence"
              value={form.residence || ""}
              onChange={(event) => onChange({ ...form, residence: event.target.value })}
            />
          </label>
          <label>
            {fatherPhoneLabel}
            <input
              data-e2e="student-form-father-phone"
              inputMode="tel"
              value={form.fatherPhone || ""}
              onChange={(event) => onChange({ ...form, fatherPhone: event.target.value })}
            />
          </label>
          <label>
            {motherPhoneLabel}
            <input
              data-e2e="student-form-mother-phone"
              inputMode="tel"
              value={form.motherPhone || ""}
              onChange={(event) => onChange({ ...form, motherPhone: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-row student-form-row--three">
          <label>
            {guardianPhoneLabel}
            <input
              data-e2e="student-form-guardian-phone"
              inputMode="tel"
              value={form.guardianPhone || ""}
              onChange={(event) => onChange({ ...form, guardianPhone: event.target.value })}
            />
          </label>
          <label>
            {t("students.healthFund")}
            <input
              data-e2e="student-form-health-fund"
              value={form.healthFund || ""}
              onChange={(event) => onChange({ ...form, healthFund: event.target.value })}
            />
          </label>
          <label>
            {studentPhoneLabel}
            <input
              data-e2e="student-form-student-phone"
              inputMode="tel"
              value={form.studentPhone || ""}
              onChange={(event) => onChange({ ...form, studentPhone: event.target.value })}
            />
          </label>
        </div>

        <div className="student-form-footer">
          <div className="actions">
            <button type="button" data-e2e="student-form-save" onClick={onSave} disabled={saving}>
              {saving ? t("students.saving") : t("common.save")}
            </button>
            <button
              type="button"
              data-e2e="student-form-reset"
              className="secondary"
              onClick={onReset}
              disabled={saving}
            >
              {t("common.clear")}
            </button>
          </div>
          {message && (
            <div className="form-message" role="status">
              {message}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
