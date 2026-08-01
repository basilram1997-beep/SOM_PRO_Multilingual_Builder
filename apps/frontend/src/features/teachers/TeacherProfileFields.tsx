import type { ReactNode } from "react";
import type { Teacher } from "@som/shared";
import { localizeClassName, localizeDay } from "../../i18n/displayNames";
import { arabicDays, effectiveLoad, preferredClassText, releaseHoursUsed } from "./teacherHelpers";
import type { AppLanguage, Translate } from "./teacherTypes";

function toggleStringValue(values: string[], value: string, order: string[]) {
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  const rank = new Map(order.map((item, index) => [item, index]));
  return Array.from(new Set(next)).sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
}

function toggleNumberValue(values: number[], value: number) {
  const next = values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  return Array.from(new Set(next)).sort((a, b) => a - b);
}

function toggleClassValue(values: string[], value: string, order: string[]) {
  return toggleStringValue(values, value, order);
}

type Props = {
  t: Translate;
  language: AppLanguage;
  form: Teacher;
  schoolClasses: { id: string; name: string }[];
  workingDays: string[];
  periodsPerDay: number;
  onFormChange: (teacher: Teacher) => void;
};

function ChoiceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="teacher-choice-group">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function ChoiceDisclosure({
  summary,
  children,
  defaultOpen = false
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="teacher-choice-disclosure" open={defaultOpen}>
      <summary>
        <strong>{summary}</strong>
      </summary>
      <div className="teacher-choice-disclosure-body">{children}</div>
    </details>
  );
}

export function TeacherProfileFields({
  t,
  language,
  form,
  schoolClasses,
  workingDays,
  periodsPerDay,
  onFormChange
}: Props) {
  const schoolDays = workingDays.length ? workingDays : arabicDays;
  const periodCount = Math.min(12, Math.max(periodsPerDay || 12, ...(form.preferredPeriods || [])));
  const periodOptions = Array.from({ length: Math.max(1, periodCount) }, (_, index) => index + 1);
  const classOrder = schoolClasses.map((cls) => cls.id);
  const selectedClassesText = preferredClassText(form, schoolClasses, language);
  const selectedDaysText = (form.preferredDays || []).map((day) => localizeDay(day, language)).join("، ");
  const selectedPeriodsText = (form.preferredPeriods || []).length
    ? `${(form.preferredPeriods || []).length} ${t("common.period")}`
    : t("common.none");
  const currentReleaseHours = releaseHoursUsed(form);
  const currentEffectiveLoad = effectiveLoad({ targetLoad: form.targetLoad, releaseHours: currentReleaseHours });

  return (
    <div className="form teacher-profile-form teacher-profile-form--dense">
      <div className="teacher-profile-row teacher-profile-row--primary">
        <label>
          {t("teachers.name")}
          <input
            value={form.name}
            onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            placeholder={t("teachers.name")}
          />
        </label>
        <label>
          {t("teachers.employeeNumber")}
          <input
            value={form.employeeNumber || ""}
            onChange={(e) => onFormChange({ ...form, employeeNumber: e.target.value })}
            placeholder={t("teachers.employeeNumber")}
          />
        </label>
        <label>
          {t("teachers.adminRole")}
          <input
            value={form.adminRole || ""}
            onChange={(e) =>
              onFormChange({
                ...form,
                adminRole: e.target.value.trim() ? e.target.value : "",
                releaseHours: e.target.value.trim() ? form.releaseHours || 0 : 0
              })
            }
            placeholder={t("teachers.adminRole")}
          />
        </label>
        <label>
          {t("teachers.releaseHours")}
          <input
            type="number"
            min={0}
            max={form.targetLoad || 0}
            value={currentReleaseHours}
            disabled={!form.adminRole?.trim()}
            onChange={(e) =>
              onFormChange({
                ...form,
                releaseHours: Math.max(0, Math.min(Number(e.target.value) || 0, form.targetLoad || 0))
              })
            }
          />
        </label>
      </div>

      <div className="teacher-profile-row teacher-profile-row--secondary">
        <label>
          {t("teachers.employmentRatio")}
          <input
            type="number"
            min={0}
            max={100}
            value={form.employmentRatio || 100}
            onChange={(e) => onFormChange({ ...form, employmentRatio: Number(e.target.value) })}
          />
        </label>
        <label>
          {t("teachers.targetLoad")}
          <input
            type="number"
            min={0}
            value={form.targetLoad || 25}
            onChange={(e) =>
              onFormChange({
                ...form,
                targetLoad: Math.max(0, Number(e.target.value) || 0),
                releaseHours: form.adminRole?.trim()
                  ? Math.min(form.releaseHours || 0, Math.max(0, Number(e.target.value) || 0))
                  : 0
              })
            }
          />
        </label>
        <label>
          {t("teachers.specialty")}
          <input
            value={form.specialty || ""}
            onChange={(e) => onFormChange({ ...form, specialty: e.target.value })}
            placeholder={t("teachers.specialty")}
          />
        </label>
      </div>

      <div className="teacher-load-formula">
        <strong>{t("teachers.effectiveLoad")}</strong>
        <span>
          {form.targetLoad || 0} - {currentReleaseHours} = {currentEffectiveLoad}
        </span>
      </div>

      <div className="teacher-profile-row teacher-profile-row--choices">
        <ChoiceGroup title={t("teachers.classes")}>
          <ChoiceDisclosure summary={selectedClassesText || t("common.none")}>
            <div className="teacher-choice-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => onFormChange({ ...form, preferredClasses: [...schoolClasses.map((cls) => cls.id)] })}
              >
                {t("teachers.selectAllClasses")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onFormChange({ ...form, preferredClasses: [] })}
              >
                {t("common.clear")}
              </button>
            </div>
            <div className="choice-grid choice-grid-classes">
              {schoolClasses.map((cls) => (
                <button
                  key={cls.id}
                  type="button"
                  className={form.preferredClasses?.includes(cls.id) ? "choice-tile selected-choice" : "choice-tile"}
                  onClick={() =>
                    onFormChange({
                      ...form,
                      preferredClasses: toggleClassValue(form.preferredClasses || [], cls.id, classOrder)
                    })
                  }
                  aria-pressed={form.preferredClasses?.includes(cls.id)}
                  title={localizeClassName(cls.name, language)}
                >
                  {localizeClassName(cls.name, language)}
                </button>
              ))}
            </div>
          </ChoiceDisclosure>
        </ChoiceGroup>

        <ChoiceGroup title={t("teachers.preferredDays")}>
          <ChoiceDisclosure summary={selectedDaysText || t("common.none")}>
            <div className="teacher-choice-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => onFormChange({ ...form, preferredDays: [...schoolDays] })}
              >
                {t("teachers.selectAllDays")}
              </button>
              <button type="button" className="secondary" onClick={() => onFormChange({ ...form, preferredDays: [] })}>
                {t("common.clear")}
              </button>
            </div>
            <div className="choice-grid choice-grid-days">
              {schoolDays.map((day) => (
                <button
                  key={day}
                  type="button"
                  className={form.preferredDays?.includes(day) ? "choice-tile selected-choice" : "choice-tile"}
                  onClick={() =>
                    onFormChange({
                      ...form,
                      preferredDays: toggleStringValue(form.preferredDays || [], day, schoolDays)
                    })
                  }
                  aria-pressed={form.preferredDays?.includes(day)}
                >
                  {localizeDay(day, language)}
                </button>
              ))}
            </div>
          </ChoiceDisclosure>
        </ChoiceGroup>

        <ChoiceGroup title={t("teachers.preferredPeriods")}>
          <ChoiceDisclosure summary={selectedPeriodsText}>
            <div className="teacher-choice-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => onFormChange({ ...form, preferredPeriods: [...periodOptions] })}
              >
                {t("teachers.selectAllPeriods")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onFormChange({ ...form, preferredPeriods: [] })}
              >
                {t("common.clear")}
              </button>
            </div>
            <div className="choice-grid choice-grid-periods">
              {periodOptions.map((period) => (
                <button
                  key={period}
                  type="button"
                  className={
                    form.preferredPeriods?.includes(period)
                      ? "choice-tile period-chip selected-choice"
                      : "choice-tile period-chip"
                  }
                  onClick={() =>
                    onFormChange({ ...form, preferredPeriods: toggleNumberValue(form.preferredPeriods || [], period) })
                  }
                  aria-pressed={form.preferredPeriods?.includes(period)}
                >
                  {t("common.period")} {period}
                </button>
              ))}
            </div>
          </ChoiceDisclosure>
        </ChoiceGroup>
      </div>
    </div>
  );
}
