import { LicenseActivationPanel } from "../../features/licensing/LicenseActivationPanel";
import { LicenseStatusPanel } from "../../features/licensing/LicenseStatusPanel";
import { useLicensePage } from "../../features/licensing/useLicensePage";

export function LicensePage() {
  const licensePage = useLicensePage();

  return (
    <section className="license-page">
      <div className="page-title-row">
        <div>
          <h2>{licensePage.labels.title}</h2>
          <p>{licensePage.labels.subtitle}</p>
        </div>
      </div>

      <LicenseStatusPanel licensePage={licensePage} />
      <LicenseActivationPanel licensePage={licensePage} />
    </section>
  );
}
