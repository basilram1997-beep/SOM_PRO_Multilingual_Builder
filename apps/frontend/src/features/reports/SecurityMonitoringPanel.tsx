import { useMemo } from "react";
import { useI18n } from "../../i18n/i18n";
import { ReportHorizontalChart } from "./ReportHorizontalChart";
import { ReportPieChart } from "./ReportPieChart";
import type { SecurityMonitoringState } from "./useSecurityMonitoring";

type Props = {
  monitoring: SecurityMonitoringState;
};

function toDatetimeLocalValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocalValue(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

export function SecurityMonitoringPanel({ monitoring }: Props) {
  const { t } = useI18n();

  const kpis = useMemo(
    () => [
      { label: t("reports.securitySummary"), value: monitoring.security.total },
      { label: t("reports.securityBlockedMultipart"), value: monitoring.security.blockedMultipart },
      { label: t("reports.securityRateLimited"), value: monitoring.security.rateLimited },
      { label: t("reports.securityDays"), value: monitoring.security.days }
    ],
    [
      monitoring.security.blockedMultipart,
      monitoring.security.days,
      monitoring.security.rateLimited,
      monitoring.security.total,
      t
    ]
  );

  return (
    <div id="security-report-print" className="report-stack">
      <div className="security-incident-panel bulk-box">
        <div className="teacher-program-header">
          <div>
            <h3>{t("reports.securityIncidentTitle")}</h3>
            <p className="muted">{t("reports.securityIncidentHint")}</p>
          </div>
          <div className="button-group no-print">
            <button
              type="button"
              className="secondary"
              onClick={() => void monitoring.submitIncident()}
              disabled={monitoring.incidentSubmitting}
            >
              {monitoring.incidentSubmitting ? t("reports.securityIncidentSaving") : t("reports.securityIncidentSave")}
            </button>
            <button type="button" className="light" onClick={monitoring.resetIncidentForm}>
              {t("common.clear")}
            </button>
          </div>
        </div>

        <div className="details-grid top-space">
          <label>
            {t("reports.securityIncidentTitleLabel")}
            <input
              type="text"
              value={monitoring.incidentForm.title}
              onChange={(event) => monitoring.setIncidentField("title", event.target.value)}
            />
          </label>
          <label>
            {t("reports.securityIncidentSeverityLabel")}
            <select
              value={monitoring.incidentForm.severity}
              onChange={(event) =>
                monitoring.setIncidentField("severity", event.target.value as typeof monitoring.incidentForm.severity)
              }
            >
              <option value="LOW">{t("reports.securityIncidentSeverityLow")}</option>
              <option value="MEDIUM">{t("reports.securityIncidentSeverityMedium")}</option>
              <option value="HIGH">{t("reports.securityIncidentSeverityHigh")}</option>
              <option value="CRITICAL">{t("reports.securityIncidentSeverityCritical")}</option>
            </select>
          </label>
          <label>
            {t("reports.securityIncidentDetectedAtLabel")}
            <input
              type="datetime-local"
              value={toDatetimeLocalValue(monitoring.incidentForm.detectedAt)}
              onChange={(event) =>
                monitoring.setIncidentField("detectedAt", fromDatetimeLocalValue(event.target.value))
              }
            />
          </label>
        </div>

        <div className="details-grid top-space">
          <label>
            {t("reports.securityIncidentSystemsLabel")}
            <input
              type="text"
              value={monitoring.incidentForm.systemsAffected}
              onChange={(event) => monitoring.setIncidentField("systemsAffected", event.target.value)}
            />
          </label>
          <label>
            {t("reports.securityIncidentDataLabel")}
            <input
              type="text"
              value={monitoring.incidentForm.dataAffected}
              onChange={(event) => monitoring.setIncidentField("dataAffected", event.target.value)}
            />
          </label>
          <label>
            {t("reports.securityIncidentVectorLabel")}
            <input
              type="text"
              value={monitoring.incidentForm.attackVector}
              onChange={(event) => monitoring.setIncidentField("attackVector", event.target.value)}
            />
          </label>
        </div>

        <div className="details-grid top-space">
          <label>
            {t("reports.securityIncidentVulnerabilitiesLabel")}
            <textarea
              rows={3}
              value={monitoring.incidentForm.vulnerabilities}
              onChange={(event) => monitoring.setIncidentField("vulnerabilities", event.target.value)}
            />
          </label>
          <label>
            {t("reports.securityIncidentSummaryLabel")}
            <textarea
              rows={3}
              value={monitoring.incidentForm.summary}
              onChange={(event) => monitoring.setIncidentField("summary", event.target.value)}
            />
          </label>
          <label>
            {t("reports.securityIncidentNotesLabel")}
            <textarea
              rows={3}
              value={monitoring.incidentForm.evidenceNotes}
              onChange={(event) => monitoring.setIncidentField("evidenceNotes", event.target.value)}
            />
          </label>
        </div>

        {monitoring.incidentError ? <p className="muted top-space">{monitoring.incidentError}</p> : null}
        <div className="top-space">
          <strong>{t("reports.securityIncidentListTitle")}</strong>
          <p className="muted">
            {t("reports.securityIncidentCount")} {monitoring.incidentsTotal}
          </p>
          <div className="teacher-kpis">
            <div className="metric-card">
              <span>{t("reports.securityIncidentStatusSuspected")}</span>
              <strong>{monitoring.incidentCounts.SUSPECTED || 0}</strong>
            </div>
            <div className="metric-card">
              <span>{t("reports.securityIncidentStatusUnderReview")}</span>
              <strong>{monitoring.incidentCounts.UNDER_REVIEW || 0}</strong>
            </div>
            <div className="metric-card">
              <span>{t("reports.securityIncidentStatusContained")}</span>
              <strong>{monitoring.incidentCounts.CONTAINED || 0}</strong>
            </div>
            <div className="metric-card">
              <span>{t("reports.securityIncidentStatusResolved")}</span>
              <strong>{monitoring.incidentCounts.RESOLVED || 0}</strong>
            </div>
          </div>
          {monitoring.incidents.length === 0 ? (
            <p className="muted">{t("reports.securityNoIncidents")}</p>
          ) : (
            <div className="small-table top-space">
              <table>
                <thead>
                  <tr>
                    <th>{t("reports.securityIncidentReportedAt")}</th>
                    <th>{t("reports.securityIncidentStatus")}</th>
                    <th>{t("reports.securityIncidentSeverityLabel")}</th>
                    <th>{t("reports.securityIncidentTitleLabel")}</th>
                    <th>{t("reports.securityIncidentSystemsLabel")}</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoring.incidents.map((incident) => (
                    <tr key={incident.id}>
                      <td>{new Date(incident.reportedAt).toLocaleString()}</td>
                      <td>{monitoring.incidentStatusLabel(incident.status)}</td>
                      <td>{incident.severity}</td>
                      <td>{incident.title}</td>
                      <td>{incident.systemsAffected.join(", ") || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="teacher-kpis">
        {kpis.map((item) => (
          <div key={item.label} className="metric-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <pre className="report-text">{monitoring.security.text || t("reports.securityEmpty")}</pre>
      <div className="report-triple-grid">
        <ReportPieChart title={t("reports.securityActionsTitle")} data={monitoring.security.chart} />
        <ReportHorizontalChart title={t("reports.securityPathsTitle")} data={monitoring.security.byPath} />
      </div>
      <h3>{t("reports.securityRecentEvents")}</h3>
      {monitoring.security.events.length === 0 ? (
        <p className="muted">{t("reports.securityEmpty")}</p>
      ) : (
        <div className="small-table">
          <table>
            <thead>
              <tr>
                <th>{t("reports.securityTime")}</th>
                <th>{t("reports.securityAction")}</th>
                <th>{t("reports.securityMethod")}</th>
                <th>{t("reports.securityPath")}</th>
                <th>{t("reports.securityDetails")}</th>
              </tr>
            </thead>
            <tbody>
              {monitoring.security.events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.action}</td>
                  <td>{event.method}</td>
                  <td>{event.path}</td>
                  <td>{event.details ? JSON.stringify(event.details) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
