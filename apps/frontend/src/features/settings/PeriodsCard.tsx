import { Card } from "../../components/ui/Card";
import type { AppLanguage } from "../../features/daily/dailyTypes";
import { upsertPeriod } from "./useSettings";
import type { SettingPeriod } from "./settingsTypes";

type Props = {
  t: (key: string) => string;
  language: AppLanguage;
  periodsPerDay: number;
  periods: SettingPeriod[];
  localizePeriodName: (value: string, period: number, language: AppLanguage) => string;
  onPeriodsChange: (next: SettingPeriod[]) => void;
  onSave: () => void;
};

export function PeriodsCard({
  t,
  language,
  periodsPerDay,
  periods,
  localizePeriodName,
  onPeriodsChange,
  onSave
}: Props) {
  return (
    <Card title={t("settings.periodTimes")}>
      <div className="table-wrap periods-table-wrap">
        <table className="periods-table">
          <thead>
            <tr>
              <th>{t("common.period")}</th>
              <th>{t("settings.periodName")}</th>
              <th>{t("common.from")}</th>
              <th>{t("common.to")}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: periodsPerDay }, (_, i) => {
              const n = i + 1;
              const p = periods.find((x) => x.period === n) || { period: n, label: `الحصة ${n}` };
              return (
                <tr key={n}>
                  <td>{n}</td>
                  <td>
                    <input
                      value={localizePeriodName(p.label || "", n, language)}
                      onChange={(e) => onPeriodsChange(upsertPeriod(periods, n, { label: e.target.value }))}
                    />
                  </td>
                  <td>
                    <input
                      value={p.startTime || ""}
                      onChange={(e) => onPeriodsChange(upsertPeriod(periods, n, { startTime: e.target.value }))}
                      placeholder="08:10"
                    />
                  </td>
                  <td>
                    <input
                      value={p.endTime || ""}
                      onChange={(e) => onPeriodsChange(upsertPeriod(periods, n, { endTime: e.target.value }))}
                      placeholder="09:00"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={onSave}>{t("settings.savePeriods")}</button>
    </Card>
  );
}
