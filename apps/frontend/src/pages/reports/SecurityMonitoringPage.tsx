import { Card } from "../../components/ui/Card";
import { exportSectionPdf } from "../../features/daily/dailyHelpers";
import { useI18n } from "../../i18n/i18n";
import { SecurityMonitoringPanel } from "../../features/reports/SecurityMonitoringPanel";
import { useSecurityMonitoring } from "../../features/reports/useSecurityMonitoring";

export function SecurityMonitoringPage() {
  const { t, language } = useI18n();
  const monitoring = useSecurityMonitoring(language);
  const securityTitle = t("reports.securityTitle");

  return (
    <div className="page" data-e2e="security-monitoring-page">
      <h2>{securityTitle}</h2>
      <Card
        title={securityTitle}
        actions={
          <div className="button-group">
            <button type="button" className="secondary" onClick={() => void monitoring.load()}>
              {t("reports.show")}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void exportSectionPdf("security-report-print", securityTitle)}
            >
              {t("common.exportPdf")}
            </button>
          </div>
        }
      >
        <div className="form-row no-print">
          <input
            type="number"
            min={1}
            max={30}
            value={monitoring.days}
            onChange={(event) => monitoring.setDays(Math.max(1, Math.min(30, Number(event.target.value) || 7)))}
            aria-label={t("reports.securityDays")}
          />
        </div>
        {monitoring.error ? <p className="muted">{monitoring.error}</p> : null}
        <SecurityMonitoringPanel monitoring={monitoring} />
      </Card>
    </div>
  );
}
