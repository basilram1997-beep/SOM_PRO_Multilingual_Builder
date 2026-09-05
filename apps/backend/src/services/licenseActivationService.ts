import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { ensureLicenseAdminAccount } from "./authService";
import { CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, DEFAULT_ADMIN_NAME } from "./licenseRuntimeConfig";
import { shouldUseCentralLicenseServer } from "./licenseRuntimeDecisions";
import {
  activateLicenseOnCentral,
  checkCentralLicense,
  recoverAdminAccessFromCentral,
  shouldUseCentralForLicenseKey
} from "./licenseCentralClient";
import {
  getLicenseCredentialHashForStorage,
  normalizeDeviceInfo,
  parseLicenseKey,
  type LicenseDeviceInfo,
  type LicensePayload
} from "./licenseIdentity";
import {
  buildActivationMetadata,
  findConflictingLicenseActivation,
  upsertLicenseActivation
} from "./licenseRepository";
import { clearLicenseStateCache } from "./licenseRuntimeCache";
import { getDefaultSchoolId } from "./schoolContext";

function buildAdminAccountResult(adminAccount: LicensePayload["adminAccount"] | null | undefined) {
  if (!adminAccount) return null;
  return {
    name: adminAccount.name || DEFAULT_ADMIN_NAME,
    email: adminAccount.email,
    password: adminAccount.password
  };
}

function isLicenseReadyForCentral(licenseKey: string) {
  return shouldUseCentralForLicenseKey(licenseKey, CENTRAL_LICENSE_URL) || shouldUseCentralLicenseServer();
}

async function resolveActivationPayload(cleanLicense: string, normalizedDevice: ReturnType<typeof normalizeDeviceInfo>) {
  if (!isLicenseReadyForCentral(cleanLicense)) {
    return parseLicenseKey(cleanLicense);
  }

  const central = await activateLicenseOnCentral(CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, cleanLicense, normalizedDevice);
  return central?.data?.expiresAt ? (central.data as LicensePayload) : parseLicenseKey(cleanLicense);
}

function isMatchingAdminCredentials(
  account: LicensePayload["adminAccount"] | null | undefined,
  email: string,
  password: string
) {
  return Boolean(
    account?.email &&
      account?.password &&
      String(account.email).trim().toLowerCase() === email &&
      String(account.password) === password
  );
}

async function findMatchingCentralAdminAccount(
  cleanEmail: string,
  cleanPassword: string,
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>
) {
  const activations = await prisma.licenseActivation.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  for (const activation of activations) {
    const central = await checkCentralLicense(CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, activation.licenseKeyHash, normalizedDevice);
    const account = central?.data?.adminAccount;
    if (!account?.email || !account?.password) continue;
    if (!isMatchingAdminCredentials(account, cleanEmail, cleanPassword)) continue;

    await ensureLicenseAdminAccount(account, central?.data as LicensePayload, true);
    return {
      email: account.email,
      name: account.name || DEFAULT_ADMIN_NAME,
      role: account.role || "ADMIN"
    };
  }

  return null;
}

export async function activateLicense(licenseKey: string, schoolIdOverride?: string, deviceInfo?: LicenseDeviceInfo) {
  const schoolId = schoolIdOverride || (await getDefaultSchoolId());
  return activateLicenseForSchool(schoolId, licenseKey, deviceInfo);
}

export async function activateLicenseForSchool(
  schoolId: string,
  licenseKey: string,
  deviceInfo?: LicenseDeviceInfo
) {
  const cleanLicense = String(licenseKey || "").trim();
  if (!cleanLicense) throw new Error("INVALID_LICENSE_FORMAT");

  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const keyHash = getLicenseCredentialHashForStorage(cleanLicense);
  const payload = await resolveActivationPayload(cleanLicense, normalizedDevice);

  const existingOnOtherDevice = await findConflictingLicenseActivation(keyHash, normalizedDevice.deviceId);
  if (existingOnOtherDevice) throw new Error("LICENSE_ALREADY_USED_ON_OTHER_DEVICE");

  const metadata = buildActivationMetadata(payload, normalizedDevice, cleanLicense);
  const adminUser = await ensureLicenseAdminAccount(payload.adminAccount, payload, false);

  const activation = await upsertLicenseActivation({
    schoolId,
    licenseKeyHash: keyHash,
    payload,
    device: normalizedDevice,
    metadata: metadata as Prisma.InputJsonValue
  });

  clearLicenseStateCache(schoolId, normalizedDevice.deviceId);

  return {
    ...activation,
    adminUser,
    adminAccount: buildAdminAccountResult(payload.adminAccount)
  };
}

export async function bootstrapLicenseAccess(licenseKey: string, deviceInfo?: LicenseDeviceInfo) {
  const schoolId = await getDefaultSchoolId();
  return activateLicenseForSchool(schoolId, licenseKey, deviceInfo);
}

export async function recoverLicenseAdminAccess(licenseKey: string, email?: string) {
  const cleanLicense = String(licenseKey || "").trim();
  if (!cleanLicense) throw new Error("INVALID_LICENSE_FORMAT");

  if (!CENTRAL_LICENSE_URL && !shouldUseCentralLicenseServer()) {
    throw new Error("RECOVERY_NOT_AVAILABLE");
  }

  const central = await recoverAdminAccessFromCentral(CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, cleanLicense, email);
  if (!central?.data) throw new Error("CENTRAL_LICENSE_UNAVAILABLE");

  const account = central.data.adminAccount;
  if (!account?.email || !central.data.resetToken) throw new Error("RECOVERY_NOT_AVAILABLE");

  return {
    email: account.email,
    resetToken: central.data.resetToken,
    resetTokenExpiresAt: central.data.resetTokenExpiresAt,
    name: account.name || DEFAULT_ADMIN_NAME
  };
}

export async function syncLicenseAdminAccountForLogin(
  email: string,
  password: string,
  deviceInfo?: LicenseDeviceInfo,
  licenseKey?: string
) {
  const cleanEmail = String(email || "")
    .trim()
    .toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword || (!CENTRAL_LICENSE_URL && !shouldUseCentralLicenseServer())) return null;

  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const cleanLicense = String(licenseKey || "").trim();

  if (cleanLicense && isLicenseReadyForCentral(cleanLicense)) {
    try {
      const central = await activateLicenseOnCentral(CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, cleanLicense, normalizedDevice);
      const account = central?.data?.adminAccount;
      if (account?.email && account?.password && isMatchingAdminCredentials(account, cleanEmail, cleanPassword)) {
        await ensureLicenseAdminAccount(account, central?.data as LicensePayload, true);
        return {
          email: account.email,
          name: account.name || DEFAULT_ADMIN_NAME,
          role: account.role || "ADMIN"
        };
      }
    } catch {
      // Fall back to locally stored activations below. Never log credentials.
    }
  }

  return findMatchingCentralAdminAccount(cleanEmail, cleanPassword, normalizedDevice);
}
