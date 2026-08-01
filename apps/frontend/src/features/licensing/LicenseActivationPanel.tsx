import { useLicensePage } from "./useLicensePage";

type LicensePageState = ReturnType<typeof useLicensePage>;

type Props = {
  licensePage: LicensePageState;
};

export function LicenseActivationPanel({ licensePage }: Props) {
  return (
    <div className="license-activate-panel">
      <div className="license-activate-grid">
        <label>{licensePage.labels.key}</label>
        <input
          dir="ltr"
          value={licensePage.licenseKey}
          onChange={(e) => licensePage.setLicenseKey(e.target.value.toUpperCase())}
          placeholder={licensePage.labels.placeholder}
        />
        <button onClick={licensePage.activate} disabled={licensePage.loading || !licensePage.licenseKey.trim()}>
          {licensePage.loading ? licensePage.labels.activating : licensePage.labels.activate}
        </button>
      </div>
      {licensePage.message && <p className="license-message">{licensePage.message}</p>}
    </div>
  );
}
