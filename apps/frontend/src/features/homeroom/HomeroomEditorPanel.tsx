import { localizeClassName, localizeDay, localizeTeacherName } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import type { HomeroomClass, HomeroomForm, HomeroomTeacher } from "./homeroomTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  form: HomeroomForm;
  teachers: HomeroomTeacher[];
  classes: HomeroomClass[];
  workingDays: string[];
  periods: number[];
  bulkDay: string;
  bulkPeriod: number;
  conflicts: string[];
  teacherIdFromClassName: (className: string) => string;
  onFormChange: (next: HomeroomForm) => void;
  onBulkDayChange: (value: string) => void;
  onBulkPeriodChange: (value: number) => void;
  onSelectAll: () => void;
  onApplyBulkTime: () => void;
  onSaveHomeroom: () => void;
  onApplyNoOverwrite: () => void;
  onApplyOverwrite: () => void;
  onToggleClass: (classId: string) => void;
};

export function HomeroomEditorPanel(props: Props) {
  const { t, language, form, teachers, classes, workingDays, periods, bulkDay, bulkPeriod, conflicts } = props;
  return (
    <>
      <div className="homeroom-editor-layout">
        <div className="form homeroom-editor-row homeroom-time-section">
          <label>
            {t("homeroom.weeklyDay")}
            <select value={form.weeklyDay} onChange={(e) => props.onFormChange({ ...form, weeklyDay: e.target.value })}>
              {workingDays.map((day) => (
                <option key={day} value={day}>
                  {localizeDay(day, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.period")}
            <select
              value={form.weeklyPeriod}
              onChange={(e) => props.onFormChange({ ...form, weeklyPeriod: Number(e.target.value) })}
            >
              {periods.map((period) => (
                <option key={period} value={period}>
                  {t("common.period")} {period}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form homeroom-editor-row homeroom-assignment-section">
          <label>
            {t("common.teacher")}
            <select value={form.teacherId} onChange={(e) => props.onFormChange({ ...form, teacherId: e.target.value })}>
              <option value="">{t("homeroom.selectTeacher")}</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {localizeTeacherName(teacher.name, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.class")}
            <select
              value={form.classId}
              onChange={(e) => {
                const cls = classes.find((item) => item.id === e.target.value);
                props.onFormChange({
                  ...form,
                  classId: e.target.value,
                  teacherId: form.teacherId || (cls ? props.teacherIdFromClassName(cls.name) : "")
                });
              }}
            >
              <option value="">{t("homeroom.selectClass")}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {localizeClassName(cls.name, language)}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button onClick={props.onSaveHomeroom}>{t("homeroom.save")}</button>
          </div>
        </div>

        <div className="form bulk-box">
          <h3>{t("homeroom.autoTitle")}</h3>
          <label>
            {t("common.day")}
            <select value={bulkDay} onChange={(e) => props.onBulkDayChange(e.target.value)}>
              {workingDays.map((day) => (
                <option key={day} value={day}>
                  {localizeDay(day, language)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("common.period")}
            <select value={bulkPeriod} onChange={(e) => props.onBulkPeriodChange(Number(e.target.value))}>
              {periods.map((period) => (
                <option key={period} value={period}>
                  {t("common.period")} {period}
                </option>
              ))}
            </select>
          </label>
          <div className="actions">
            <button type="button" onClick={props.onSelectAll}>
              {t("homeroom.selectAll")}
            </button>
            <button type="button" onClick={props.onApplyBulkTime}>
              {t("homeroom.applySelected")}
            </button>
          </div>
          <p className="muted">{t("homeroom.noSelectionHint")}</p>
        </div>
      </div>

      <div className="actions top-space">
        <button onClick={props.onApplyNoOverwrite}>{t("homeroom.applyNoOverwrite")}</button>
        <button className="danger" onClick={props.onApplyOverwrite}>
          {t("homeroom.applyOverwrite")}
        </button>
      </div>
      {conflicts.length > 0 && (
        <div className="alert">
          {conflicts.map((conflict) => (
            <p key={conflict}>{conflict}</p>
          ))}
        </div>
      )}
    </>
  );
}
