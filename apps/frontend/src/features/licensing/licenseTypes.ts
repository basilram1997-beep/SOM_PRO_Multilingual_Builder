import type { DesktopLicenseSetup } from "../../types/somDesktop";
import type { Translate } from "../teachers/teacherTypes";

export type LicenseStatus = {
  readOnly?: boolean;
  status?: string;
  plan?: string;
  expiresAt?: string;
  maxDevices?: number | string;
  schoolName?: string;
  institutionCode?: string;
  activeDevicesCount?: number;
  deviceName?: string;
  gracePeriodUntil?: string;
  readOnlyReason?: string;
};

export type LicenseLabels = {
  loadError: string;
  activated: string;
  activateError: string;
  title: string;
  subtitle: string;
  readOnly: string;
  active: string;
  status: string;
  plan: string;
  expiresAt: string;
  maxDevices: string;
  schoolName: string;
  institutionCode: string;
  key: string;
  placeholder: string;
  activating: string;
  activate: string;
  autoActivated: string;
  installerDetected: string;
  installerStatus: string;
  licenseCode: string;
  setupFallback: string;
  activeDevices: string;
  graceUntil: string;
  deviceName: string;
};

export type LicensePageState = {
  labels: LicenseLabels;
  license: LicenseStatus | null;
  licenseKey: string;
  installerSetup: DesktopLicenseSetup | null;
  message: string;
  loading: boolean;
  readOnly: boolean;
  hasServerLicense: boolean;
  displaySchoolName: string;
  displayInstitutionCode: string;
  displayPlan: string;
  displayExpiresAt?: string;
  displayMaxDevices: number | string;
  displayLicenseCode: string;
  activeDevicesDisplay: string;
  setLicenseKey: (value: string) => void;
  activate: () => Promise<void>;
  formatDate: (value?: string) => string;
};

export function buildLicenseLabels(t: Translate): LicenseLabels {
  return {
    loadError: t("license.loadError"),
    activated: t("license.activated"),
    activateError: t("license.activateError"),
    title: t("license.title"),
    subtitle: t("license.subtitle"),
    readOnly: t("license.readOnly"),
    active: t("license.active"),
    status: t("license.status"),
    plan: t("license.plan"),
    expiresAt: t("license.expiresAt"),
    maxDevices: t("license.maxDevices"),
    schoolName: t("license.schoolName"),
    institutionCode: t("license.institutionCode"),
    key: t("license.key"),
    placeholder: t("license.placeholder"),
    activating: t("license.activating"),
    activate: t("license.activate"),
    autoActivated: t("license.autoActivated"),
    installerDetected: t("license.installerDetected"),
    installerStatus: t("license.installerStatus"),
    licenseCode: t("license.licenseCode"),
    setupFallback: t("license.setupFallback"),
    activeDevices: t("license.activeDevices"),
    graceUntil: t("license.graceUntil"),
    deviceName: t("license.deviceName")
  };
}
