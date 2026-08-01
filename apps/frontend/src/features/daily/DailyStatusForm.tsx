import type { DailyStatusType, DailyTeacher, Translate, AppLanguage } from "./dailyTypes";
import { localizeDay, localizeTeacherName } from "../../i18n/displayNames";

type Props = {
  t: Translate;
  language: AppLanguage;
  date: string;
  day: string;
  workingDays: string[];
  teachers: DailyTeacher[];
  teacherId: string;
  type: DailyStatusType;
  fromPeriod: number;
  toPeriod: number;
  reason: string;
  periods: number[];
  onDateChange: (value: string) => void;
  onDayChange: (value: string) => void;
  onTeacherChange: (value: string) => void;
  onTypeChange: (value: DailyStatusType) => void;
  onFromPeriodChange: (value: number) => void;
  onToPeriodChange: (value: number) => void;
  onReasonChange: (value: string) => void;
  onAdd: () => void;
};

export function DailyStatusForm(props: Props) {
  const { t, language, date, day, workingDays, teachers, teacherId, type, fromPeriod, toPeriod, periods, reason } =
    props;
  return (
    <div className="daily-status-form">
      <div className="daily-status-row daily-status-row--meta">
        <label>
          {t("common.date")}
          <input
            data-e2e="daily-status-date"
            type="date"
            value={date}
            onChange={(e) => props.onDateChange(e.target.value)}
          />
        </label>
        <label>
          {t("common.day")}
          <select data-e2e="daily-status-day" value={day} onChange={(e) => props.onDayChange(e.target.value)}>
            {workingDays.map((d) => (
              <option key={d} value={d}>
                {localizeDay(d, language)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="daily-status-row daily-status-row--teacher">
        <label>
          {t("common.teacher")}
          <select
            data-e2e="daily-status-teacher"
            value={teacherId}
            onChange={(e) => props.onTeacherChange(e.target.value)}
          >
            <option value="">{t("daily.selectTeacher")}</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {localizeTeacherName(teacher.name, language)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("common.status")}
          <select
            data-e2e="daily-status-type"
            value={type}
            onChange={(e) => props.onTypeChange(e.target.value as DailyStatusType)}
          >
            <option value="ABSENT">{t("daily.absent")}</option>
            <option value="LATE">{t("daily.late")}</option>
            <option value="LEFT">{t("daily.left")}</option>
            <option value="UNAVAILABLE">{t("daily.mission")}</option>
          </select>
        </label>
      </div>
      <div className="daily-status-row daily-status-row--periods">
        <label>
          {t("daily.fromPeriod")}
          <select
            data-e2e="daily-status-from"
            value={fromPeriod}
            onChange={(e) => props.onFromPeriodChange(Number(e.target.value))}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {t("daily.fromPeriod")} {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("daily.toPeriod")}
          <select
            data-e2e="daily-status-to"
            value={toPeriod}
            onChange={(e) => props.onToPeriodChange(Number(e.target.value))}
          >
            {periods.map((p) => (
              <option key={p} value={p}>
                {t("daily.toPeriod")} {p}
              </option>
            ))}
          </select>
        </label>
        <label className="daily-status-note">
          {t("daily.add")}
          <input
            data-e2e="daily-status-reason"
            type="text"
            value={reason}
            onChange={(e) => props.onReasonChange(e.target.value)}
            placeholder={t("daily.statusReasonPlaceholder")}
          />
        </label>
        <div className="daily-status-actions">
          <button data-e2e="daily-status-add" type="button" onClick={props.onAdd}>
            {t("daily.add")}
          </button>
        </div>
      </div>
    </div>
  );
}
