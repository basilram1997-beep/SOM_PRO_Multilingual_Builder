import { useI18n } from "../../i18n/i18n";
import { PeriodsCard } from "../../features/settings/PeriodsCard";
import { SchoolInfoCard } from "../../features/settings/SchoolInfoCard";
import { WorkingDaysCard } from "../../features/settings/WorkingDaysCard";
import { useSettings } from "../../features/settings/useSettings";

export function SettingsPage() {
  const { t, language } = useI18n();
  // localizeDay(day, language)
  const settings = useSettings(
    t("settings.enterSchoolName"),
    t("settings.saveSchoolInfo"),
    t("settings.saveSettings"),
    t("settings.savePeriods")
  );

  return (
    <div className="page settings-page">
      <h2>{t("settings.title")}</h2>
      <div className="grid two">
        <SchoolInfoCard
          t={t}
          language={language}
          schoolInfo={settings.schoolInfo}
          message={settings.message}
          onChange={settings.setSchoolInfo}
          onSave={settings.saveSchoolInfo}
        />

        <WorkingDaysCard
          t={t}
          language={language}
          workingDays={settings.workingDays}
          periodsPerDay={settings.periodsPerDay}
          maxTeachers={settings.maxTeachers}
          onToggleDay={settings.toggleDay}
          onPeriodsPerDayChange={settings.setPeriodsPerDay}
          onMaxTeachersChange={settings.setMaxTeachers}
          onSave={settings.save}
        />

        <div className="settings-periods-span">
          <PeriodsCard
            t={t}
            language={language}
            periodsPerDay={settings.periodsPerDay}
            periods={settings.periods}
            localizePeriodName={settings.localizePeriodName}
            onPeriodsChange={settings.setPeriods}
            onSave={settings.savePeriods}
          />
        </div>
      </div>
    </div>
  );
}
