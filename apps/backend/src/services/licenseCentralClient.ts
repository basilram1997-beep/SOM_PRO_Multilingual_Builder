import crypto from "node:crypto";
import { LicenseStatus } from "@prisma/client";
import type { LicenseDeviceInfo, LicensePayload } from "./licenseIdentity";

export type CentralLicenseResult = {
  data?: Partial<LicensePayload> & {
    schoolName?: string;
    institutionCode?: string;
    resetToken?: string;
    resetTokenExpiresAt?: string;
  };
  status?: LicenseStatus;
  readOnly?: boolean;
  error?: string;
  message?: string;
  activeDevicesCount?: number;
  serverTime?: string;
};

export type CentralLicenseError = Error & {
  licenseStatus?: LicenseStatus;
  readOnly?: boolean;
  errorCode?: string;
};

export function shouldUseCentralForLicenseKey(licenseKey: string, centralLicenseUrl: string) {
  const cleanLicense = String(licenseKey || "").trim();
  if (!centralLicenseUrl) return false;
  if (cleanLicense.includes(".")) return false;
  return true;
}

async function postCentral(
  centralLicenseUrl: string,
  path: string,
  body: unknown,
  timeoutMs: number
): Promise<CentralLicenseResult | null> {
  if (!centralLicenseUrl) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(centralLicenseUrl.replace(/\/$/, "") + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-Nonce": crypto.randomBytes(24).toString("hex")
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || "CENTRAL_LICENSE_REJECTED") as CentralLicenseError;
      error.licenseStatus = payload.status;
      error.readOnly = payload.readOnly;
      error.errorCode = String(payload.error || payload.code || payload.errorCode || "");
      throw error;
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkCentralLicense(
  centralLicenseUrl: string,
  timeoutMs: number,
  licenseKeyHash: string,
  deviceInfo: Required<LicenseDeviceInfo>
): Promise<CentralLicenseResult | null> {
  try {
    return await postCentral(centralLicenseUrl, "/api/client/check", { licenseKeyHash, ...deviceInfo }, timeoutMs);
  } catch (error: unknown) {
    const normalizedError = error as CentralLicenseError;
    return {
      error: normalizedError.errorCode || normalizedError.message || "CENTRAL_LICENSE_UNAVAILABLE",
      status: normalizedError.licenseStatus,
      readOnly: normalizedError.readOnly,
      message: normalizedError.message
    };
  }
}

export async function recoverAdminAccessFromCentral(
  centralLicenseUrl: string,
  timeoutMs: number,
  licenseKey: string,
  email?: string
) {
  return postCentral(centralLicenseUrl, "/api/client/recover-admin", { licenseKey, licenseCode: licenseKey, email }, timeoutMs);
}

export async function activateLicenseOnCentral(
  centralLicenseUrl: string,
  timeoutMs: number,
  licenseKey: string,
  deviceInfo: Required<LicenseDeviceInfo>
) {
  return postCentral(
    centralLicenseUrl,
    "/api/client/activate",
    { licenseKey, licenseCode: licenseKey, ...deviceInfo },
    timeoutMs
  );
}
