import { useI18n } from "../../i18n/i18n";
import type { SchoolOperationsState } from "./useSchoolOperations";

type Props = {
  operations: SchoolOperationsState;
};

function ageSince(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "-";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function SchoolOperationsPanel({ operations }: Props) {
  const { t } = useI18n();

  const reportExports = operations.operations.reportExports;
  const backupJobs = operations.operations.backupJobs;
  const lastSuccessfulBackup = operations.operations.lastSuccessfulBackup;
  const formatLabel =
    operations.operations.auditLogExport.format.toLowerCase() === "jsonl"
      ? t("reports.operationAuditExportFormatJsonl")
      : operations.operations.auditLogExport.format.toUpperCase();

  function operationStatusLabel(status: string) {
    const key =
      status === "REQUESTED"
        ? "reports.operationStatusRequested"
        : status === "PENDING"
          ? "reports.operationStatusPending"
          : status === "COMPLETED"
            ? "reports.operationStatusCompleted"
            : status === "FAILED"
              ? "reports.operationStatusFailed"
              : "reports.operationStatusUnknown";
    return t(key);
  }

  function fileTypeLabel(fileType: string) {
    const key =
      fileType.toLowerCase() === "jsonl" ? "reports.operationFileTypeJsonl" : "reports.operationFileTypeUnknown";
    return t(key);
  }

  return (
    <div className="security-incident-panel bulk-box top-space">
      <div className="teacher-program-header">
        <div>
          <h3>{t("reports.operationsTitle")}</h3>
          <p className="muted">{t("reports.operationsHint")}</p>
        </div>
        <div className="button-group no-print">
          <button type="button" className="light" onClick={() => void operations.load()} disabled={operations.loading}>
            {operations.loading ? t("reports.loading") : t("common.refresh")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void operations.createBackup()}
            disabled={operations.creatingBackup}
          >
            {operations.creatingBackup ? t("reports.operationsCreatingBackup") : t("reports.operationsCreateBackup")}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void operations.exportAuditLog()}
            disabled={operations.exporting}
          >
            {operations.exporting ? t("reports.operationsExportingAuditLog") : t("reports.operationsExportAuditLog")}
          </button>
        </div>
      </div>

      {operations.error ? <p className="muted top-space">{operations.error}</p> : null}

      <div className="teacher-kpis top-space">
        <div className="metric-card">
          <span>{t("reports.operationReportsTitle")}</span>
          <strong>{reportExports.length}</strong>
        </div>
        <div className="metric-card">
          <span>{t("reports.operationBackupsTitle")}</span>
          <strong>{backupJobs.length}</strong>
        </div>
        <div className="metric-card">
          <span>{t("reports.operationEncrypted")}</span>
          <strong>{backupJobs.filter((job) => job.encrypted).length}</strong>
        </div>
        <div className="metric-card">
          <span>{t("reports.operationLastSuccessfulBackup")}</span>
          <strong>{lastSuccessfulBackup?.finishedAt ? ageSince(lastSuccessfulBackup.finishedAt) : "-"}</strong>
        </div>
        <div className="metric-card">
          <span>{t("reports.operationAuditExport")}</span>
          <strong>{formatLabel}</strong>
        </div>
      </div>

      <div className="muted top-space">
        {t("reports.operationAuditExportPath")}: <code>{operations.operations.auditLogExport.path}</code>
      </div>
      {lastSuccessfulBackup ? (
        <div className="muted top-space">
          {t("reports.operationLastSuccessfulBackupPath")}: <code dir="ltr">{lastSuccessfulBackup.filePath}</code>
        </div>
      ) : null}

      <div className="top-space">
        <strong>{t("reports.operationReportsTitle")}</strong>
        {reportExports.length === 0 ? (
          <p className="muted">{t("reports.operationNoReports")}</p>
        ) : (
          <div className="small-table top-space">
            <table>
              <thead>
                <tr>
                  <th>{t("reports.operationFileType")}</th>
                  <th>{t("reports.operationStatus")}</th>
                  <th>{t("reports.operationCreatedBy")}</th>
                  <th>{t("reports.operationAge")}</th>
                  <th>{t("reports.operationExpiresAt")}</th>
                  <th>{t("reports.operationPath")}</th>
                </tr>
              </thead>
              <tbody>
                {reportExports.map((item) => (
                  <tr key={item.id}>
                    <td>{`${item.reportType} · ${fileTypeLabel(item.fileType)}`}</td>
                    <td>{operationStatusLabel(item.status)}</td>
                    <td>{item.requestedByName || item.requestedBy || "-"}</td>
                    <td>{ageSince(item.createdAt)}</td>
                    <td>{item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "-"}</td>
                    <td>
                      <code dir="ltr">{item.filePath}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="top-space">
        <strong>{t("reports.operationBackupsTitle")}</strong>
        {backupJobs.length === 0 ? (
          <p className="muted">{t("reports.operationNoBackups")}</p>
        ) : (
          <div className="small-table top-space">
            <table>
              <thead>
                <tr>
                  <th>{t("reports.operationBackupType")}</th>
                  <th>{t("reports.operationStatus")}</th>
                  <th>{t("reports.operationCreatedBy")}</th>
                  <th>{t("reports.operationAge")}</th>
                  <th>{t("reports.operationEncrypted")}</th>
                  <th>{t("reports.operationPath")}</th>
                </tr>
              </thead>
              <tbody>
                {backupJobs.map((item) => (
                  <tr key={item.id}>
                    <td>{item.backupType}</td>
                    <td>{operationStatusLabel(item.status)}</td>
                    <td>{item.createdByName || item.createdBy || "-"}</td>
                    <td>{ageSince(item.startedAt)}</td>
                    <td>{item.encrypted ? t("common.yes") : t("common.no")}</td>
                    <td>
                      <code dir="ltr">{item.filePath}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
