import { getAuthToken } from "../../api/http";
import { somApi } from "../../api/somApi";
import type { DesktopLicenseSetup } from "../../types/somDesktop";

function isLocalDesktopMode() {
  const mode = String(window.somDesktop?.mode || "")
    .trim()
    .toLowerCase();
  return mode === "local-trial" || mode === "development";
}

export function shouldPersistLicenseSetupOnServer() {
  if (!window.somDesktop) return true;
  return !isLocalDesktopMode();
}

function canUseLocalDesktopPersistence() {
  return Boolean(window.somDesktop) && isLocalDesktopMode();
}

export async function loadPersistedLicenseSetup(): Promise<DesktopLicenseSetup | null> {
  if (canUseLocalDesktopPersistence()) {
    return window.somDesktop?.licenseSetup || null;
  }

  if (!getAuthToken()) {
    return null;
  }

  try {
    const response = await somApi.license.setup();
    return response.data || null;
  } catch {
    return null;
  }
}

export async function savePersistedLicenseSetup(setup: DesktopLicenseSetup) {
  if (canUseLocalDesktopPersistence()) {
    return window.somDesktop?.saveLicenseSetup?.(setup) || null;
  }

  if (!getAuthToken()) {
    return null;
  }

  try {
    return (await somApi.license.saveSetup(setup)).data || null;
  } catch {
    return null;
  }
}
