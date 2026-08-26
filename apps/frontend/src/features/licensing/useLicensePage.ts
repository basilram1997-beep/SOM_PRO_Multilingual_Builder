import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { somApi } from "../../api/somApi";
import { useI18n } from "../../i18n/i18n";
import type { DesktopLicenseSetup } from "../../types/somDesktop";
import { formatDate, parseLicensePayload } from "./licenseHelpers";
import { buildLicenseLabels, type LicenseStatus } from "./licenseTypes";

let appliedInstallerLicenseMemory = "";
let lastSuccessfulLicenseState: LicenseStatus | null = null;

function readAppliedInstallerLicense() {
  return appliedInstallerLicenseMemory;
}

function markAppliedInstallerLicense(licenseCode: string) {
  appliedInstallerLicenseMemory = licenseCode;
}

export function useLicensePage() {
  const { t } = useI18n();
  const labels = useMemo(() => buildLicenseLabels(t), [t]);
  const [license, setLicense] = useState<LicenseStatus | null>(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [installerSetup, setInstallerSetup] = useState<DesktopLicenseSetup | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const loadSequence = useRef(0);

  const load = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const res = await somApi.license.status();
      const nextLicense = (res.data || null) as LicenseStatus | null;
      if (sequence === loadSequence.current) {
        setLicense((current) => {
          if (!lastSuccessfulLicenseState) return nextLicense;
          if (!nextLicense) return lastSuccessfulLicenseState;
          if (current && current.readOnly === false && nextLicense.readOnly === true) {
            return current;
          }
          if (
            current &&
            current.status &&
            nextLicense.status &&
            current.status !== nextLicense.status &&
            current.readOnly === false &&
            nextLicense.readOnly === true
          ) {
            return current;
          }
          if (nextLicense.readOnly === false) {
            lastSuccessfulLicenseState = nextLicense;
            return nextLicense;
          }
          if (lastSuccessfulLicenseState.readOnly === false) {
            return lastSuccessfulLicenseState;
          }
          return nextLicense;
        });
      }
    } catch {
      if (sequence === loadSequence.current) {
        setMessage(labels.loadError);
      }
    }
  }, [labels]);

  const activateWithKey = useCallback(
    async (key: string, automatic = false) => {
      const cleanKey = key.trim();
      if (!cleanKey) return;
      loadSequence.current += 1;
      setLoading(true);
      setMessage(automatic ? labels.installerDetected : "");
      try {
        const activated = await somApi.license.activate(cleanKey);
        if (activated?.data) {
          lastSuccessfulLicenseState = activated.data as LicenseStatus;
          setLicense(activated.data as LicenseStatus);
          try {
            await window.somDesktop?.saveLicenseSetup?.({
              licenseCode: cleanKey,
              schoolName: activated.data.schoolName,
              institutionCode: activated.data.institutionCode,
              plan: activated.data.plan,
              expiresAt: activated.data.expiresAt,
              maxDevices: activated.data.maxDevices
            });
          } catch {
            // Best effort only. The activation state itself already succeeded.
          }
        }
        setLicenseKey("");
        if (automatic) markAppliedInstallerLicense(cleanKey);
        setMessage(automatic ? labels.autoActivated : labels.activated);
      } catch {
        setLicenseKey(cleanKey);
        setMessage(labels.activateError);
      } finally {
        setLoading(false);
      }
    },
    [labels, load]
  );

  useEffect(() => {
    const setup = window.somDesktop?.licenseSetup || null;
    setInstallerSetup(setup);
    load().catch(() => setMessage(setup ? labels.setupFallback : labels.loadError));
    const setupKey = setup?.licenseCode?.trim();
    if (setupKey) setLicenseKey(setupKey);
    if (setupKey && readAppliedInstallerLicense() !== setupKey) {
      activateWithKey(setupKey, true);
    }
    // Labels depend on the active locale, so rebuild them when the language changes.
  }, [labels, activateWithKey, load]);

  async function activate() {
    await activateWithKey(licenseKey);
  }

  const readOnly = Boolean(license?.readOnly);
  const hasServerLicense = Boolean(license?.status);
  const licensePayload = parseLicensePayload(installerSetup?.licenseCode || licenseKey);
  const displaySchoolName = license?.schoolName || installerSetup?.schoolName || licensePayload?.schoolName || "-";
  const displayInstitutionCode =
    license?.institutionCode || installerSetup?.institutionCode || licensePayload?.institutionCode || "-";
  const displayPlan = license?.plan || licensePayload?.plan || "-";
  const displayExpiresAt = license?.expiresAt || licensePayload?.expiresAt;
  const displayMaxDevices = license?.maxDevices || licensePayload?.maxDevices || "-";
  const displayLicenseCode = installerSetup?.licenseCode || licenseKey || "-";
  const activeDevicesDisplay =
    license?.activeDevicesCount != null ? `${license.activeDevicesCount}/${displayMaxDevices}` : "-";

  return {
    labels,
    license,
    licenseKey,
    installerSetup,
    message,
    loading,
    readOnly,
    hasServerLicense,
    displaySchoolName,
    displayInstitutionCode,
    displayPlan,
    displayExpiresAt,
    displayMaxDevices,
    displayLicenseCode,
    activeDevicesDisplay,
    setLicenseKey,
    activate,
    formatDate
  };
}
