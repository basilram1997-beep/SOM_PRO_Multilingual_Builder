import { Card } from "../../components/ui/Card";
import { localizeDay } from "../../i18n/displayNames";
import type { AppLanguage } from "../../features/daily/dailyTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  workingDays: string[];
  periodsPerDay: number;
  maxTeachers: number;
  onToggleDay: (day: string) => void;
  onPeriodsPerDayChange: (value: number) => void;
  onMaxTeachersChange: (value: number) => void;
  onSave: () => void;
};

const ALL_WEEK_DAYS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

export function WorkingDaysCard({
  t,
  language,
  workingDays,
  periodsPerDay,
  maxTeachers,
  onToggleDay,
  onPeriodsPerDayChange,
  onMaxTeachersChange,
  onSave
}: Props) {
  return (
    <Card title={t("settings.workingDays")}>
      <p className="muted">{t("settings.workingDaysHelp")}</p>
      <div className="days-grid">
        {ALL_WEEK_DAYS.map((day) => (
          <label key={day} className={workingDays.includes(day) ? "day selected-day" : "day"}>
            <input type="checkbox" checked={workingDays.includes(day)} onChange={() => onToggleDay(day)} />
            {localizeDay(day, language)}
          </label>
        ))}
      </div>
      <div className="form-row">
        <label>
          {t("settings.periodsPerDay")}
          <input
            type="number"
            min={1}
            max={12}
            value={periodsPerDay}
            onChange={(e) => onPeriodsPerDayChange(Number(e.target.value))}
          />
        </label>
        <label>
          {t("settings.maxTeachers")}
          <input
            type="number"
            min={1}
            max={500}
            value={maxTeachers}
            onChange={(e) => onMaxTeachersChange(Number(e.target.value))}
          />
        </label>
        <button onClick={onSave}>{t("settings.saveSettings")}</button>
      </div>
    </Card>
  );
}
