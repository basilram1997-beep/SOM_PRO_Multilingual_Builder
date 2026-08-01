import { useLicensePage } from "./useLicensePage";

type LicensePageState = ReturnType<typeof useLicensePage>;

type Props = {
  licensePage: LicensePageState;
};

export function LicenseStatusPanel({ licensePage }: Props) {
  return (
    <div className="license-status-panel">
      <div className={licensePage.readOnly ? "license-badge danger" : "license-badge ok"}>
        {licensePage.readOnly
          ? licensePage.labels.readOnly
          : licensePage.hasServerLicense
            ? licensePage.labels.active
            : licensePage.labels.installerStatus}
      </div>
      <div className="license-table-wrap">
        <table className="license-table">
          <tbody>
            <tr>
              <th>{licensePage.labels.status}</th>
              <td>
                {licensePage.license?.status || (licensePage.installerSetup ? licensePage.labels.installerStatus : "-")}
              </td>
              <th>{licensePage.labels.plan}</th>
              <td>{licensePage.displayPlan}</td>
            </tr>
            <tr>
              <th>{licensePage.labels.expiresAt}</th>
              <td>{licensePage.formatDate(licensePage.displayExpiresAt)}</td>
              <th>{licensePage.labels.maxDevices}</th>
              <td>{licensePage.displayMaxDevices}</td>
            </tr>
            <tr>
              <th>{licensePage.labels.schoolName}</th>
              <td>{licensePage.displaySchoolName}</td>
              <th>{licensePage.labels.institutionCode}</th>
              <td>{licensePage.displayInstitutionCode}</td>
            </tr>
            <tr>
              <th>{licensePage.labels.licenseCode}</th>
              <td dir="ltr">{licensePage.displayLicenseCode}</td>
              <th>{licensePage.labels.activeDevices}</th>
              <td>{licensePage.activeDevicesDisplay}</td>
            </tr>
            <tr>
              <th>{licensePage.labels.deviceName}</th>
              <td colSpan={3}>{licensePage.license?.deviceName || window.somDesktop?.device?.deviceName || "-"}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {licensePage.license?.gracePeriodUntil && (
        <p className="license-message">
          {licensePage.labels.graceUntil}: {licensePage.formatDate(licensePage.license.gracePeriodUntil)}
        </p>
      )}
      {licensePage.license?.readOnlyReason && <p className="license-warning">{licensePage.license.readOnlyReason}</p>}
    </div>
  );
}
