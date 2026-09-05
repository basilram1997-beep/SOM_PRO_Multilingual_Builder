import { activateLicenseForSchool } from "./licenseActivationService";
import {
  getPersistedLicenseSetup as loadPersistedLicenseSetup,
  savePersistedLicenseSetup as storePersistedLicenseSetup
} from "./licenseRepository";
import { getDefaultSchoolId } from "./schoolContext";

export async function resolveLicenseBootstrapSchoolId(schoolIdOverride?: string) {
  return schoolIdOverride || (await getDefaultSchoolId());
}

export async function bootstrapLicenseAccess(licenseKey: string, deviceInfo?: Parameters<typeof activateLicenseForSchool>[2]) {
  return activateLicenseForSchool(await resolveLicenseBootstrapSchoolId(), licenseKey, deviceInfo);
}

export async function getPersistedLicenseSetup(schoolIdOverride?: string) {
  return loadPersistedLicenseSetup(await resolveLicenseBootstrapSchoolId(schoolIdOverride));
}

export async function savePersistedLicenseSetup(
  setup: Parameters<typeof storePersistedLicenseSetup>[0],
  schoolIdOverride?: string,
  deviceInfo?: Parameters<typeof storePersistedLicenseSetup>[2]
) {
  return storePersistedLicenseSetup(setup, await resolveLicenseBootstrapSchoolId(schoolIdOverride), deviceInfo);
}
