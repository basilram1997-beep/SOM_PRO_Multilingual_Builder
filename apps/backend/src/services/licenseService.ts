export type { LicenseDeviceInfo, LicensePayload } from "./licenseIdentity";
export {
  getDeviceFingerprint,
  getLicenseCredentialHashForStorage,
  normalizeDeviceInfo,
  parseLicenseKey
} from "./licenseIdentity";
export { LICENSE_STATE_CACHE_TTL_MS, clearLicenseStateCache } from "./licenseRuntimeCache";
export { getPersistedLicenseSetup, savePersistedLicenseSetup } from "./licenseBootstrap";
export {
  shouldUseCentralLicenseServer,
  shouldFallbackToLocalLicense,
  getLocalFallbackLicenseStatus
} from "./licenseRuntimeDecisions";
export {
  activateLicense,
  recoverLicenseAdminAccess,
  syncLicenseAdminAccountForLogin
} from "./licenseActivationService";
export { bootstrapLicenseAccess } from "./licenseBootstrap";
export { getLicenseGuardState, getLicenseState } from "./licenseStateService";
