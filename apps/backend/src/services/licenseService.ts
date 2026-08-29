import crypto from "node:crypto";
import os from "node:os";
import { LicenseStatus, Prisma, UserRole } from "@prisma/client";
import { DesktopLicenseSetupSchema, type DesktopLicenseSetup } from "@som/shared";
import { prisma } from "../db/prisma";
import { getDefaultSchoolId } from "./schoolContext";
import { evaluateLicensePolicy } from "./licensePolicy";
import { ensureLicenseAdminAccount } from "./authService";

const TRIAL_DAYS = Number(process.env.SOM_PRO_TRIAL_DAYS || 30);
const DEFAULT_LICENSE_SECRET = "change-this-secret-before-selling";
const OWNER_SECRET = process.env.SOM_PRO_LICENSE_SECRET || DEFAULT_LICENSE_SECRET;
const CENTRAL_LICENSE_URL = process.env.SOM_PRO_LICENSE_SERVER_URL || process.env.SOM_LICENSE_SERVER_URL || "";
const REQUIRE_CENTRAL_LICENSE = process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE === "true";
const CENTRAL_TIMEOUT_MS = Number(process.env.SOM_PRO_LICENSE_TIMEOUT_MS || 5000);
const GRACE_PERIOD_DAYS = Number(process.env.SOM_PRO_LICENSE_GRACE_DAYS || 3);
const DEFAULT_ADMIN_NAME = "مدير المدرسة";
const REQUIRED_CENTRAL_NOT_CONFIGURED_MESSAGE = "لم يتم ضبط خادم الترخيص المركزي لهذه النسخة";
const RUNTIME_MODE = String(process.env.SOM_RUNTIME_MODE || process.env.NODE_ENV || "development")
  .trim()
  .toLowerCase();

export function shouldUseCentralLicenseServer(runtimeMode = RUNTIME_MODE, requireCentral = REQUIRE_CENTRAL_LICENSE) {
  return (
    requireCentral ||
    String(runtimeMode || "")
      .trim()
      .toLowerCase() === "saas"
  );
}

export type LicensePayload = {
  schoolName?: string;
  institutionCode?: string;
  plan?: string;
  expiresAt: string;
  maxDevices?: number;
  activeDevicesCount?: number;
  allowedFeatures?: string[];
  adminAccount?: {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
  };
};

export type LicenseDeviceInfo = {
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
};

type CentralLicenseResult = {
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

type CentralLicenseError = Error & {
  licenseStatus?: LicenseStatus;
  readOnly?: boolean;
  errorCode?: string;
};

type LicenseMetadata = Record<string, unknown> & {
  centralLastSuccessAt?: string;
  gracePeriodUntil?: string;
  device?: Required<LicenseDeviceInfo>;
  licenseCode?: string;
  licenseSetup?: DesktopLicenseSetup;
  licenseSetupSavedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertLicenseSecretConfigured() {
  if (process.env.NODE_ENV === "production" && OWNER_SECRET === DEFAULT_LICENSE_SECRET) {
    throw new Error("SOM_PRO_LICENSE_SECRET must be changed before selling or production use");
  }
}

function hash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeLicenseCode(value: string) {
  const compact = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  if (compact.startsWith("SOM") && compact.length > 3) {
    const rest = compact.slice(3);
    const groups: string[] = [];
    for (let i = 0; i < rest.length; i += 4) groups.push(rest.slice(i, i + 4));
    return ["SOM", ...groups].join("-");
  }
  return compact;
}

export function getLicenseCredentialHashForStorage(licenseKey: string) {
  const clean = String(licenseKey || "").trim();
  return clean.startsWith("SOM2-") || clean.includes(".") ? hash(clean) : hash(normalizeLicenseCode(clean));
}

function hmac(value: string) {
  assertLicenseSecretConfigured();
  return crypto.createHmac("sha256", OWNER_SECRET).update(value).digest("hex");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function shortLicenseSignature(payloadPart: string) {
  return hmac(payloadPart).slice(0, 4).toUpperCase();
}

function parseShortLicenseKey(licenseKey: string): LicensePayload {
  const clean = String(licenseKey || "").trim();
  const parts = clean.split("-");
  if (parts.length !== 3 || parts[0] !== "SOM2") throw new Error("INVALID_LICENSE_FORMAT");

  const [, institutionCode, signature] = parts;
  if (!/^[A-Z0-9-]+$/i.test(institutionCode) || !/^[A-Z0-9]{4}$/i.test(signature)) {
    throw new Error("INVALID_LICENSE_FORMAT");
  }

  const payloadPart = institutionCode.toUpperCase();
  if (
    shortLicenseSignature(payloadPart) !==
    String(signature || "")
      .trim()
      .toUpperCase()
  ) {
    throw new Error("INVALID_LICENSE_SIGNATURE");
  }

  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(expiresAt.getTime())) throw new Error("INVALID_LICENSE_EXPIRY");

  return {
    plan: "TRIAL",
    institutionCode: institutionCode.toUpperCase(),
    expiresAt: expiresAt.toISOString(),
    maxDevices: 1,
    allowedFeatures: ["browser-e2e"]
  };
}

function fallbackDeviceId() {
  const raw = [os.hostname(), os.platform(), os.arch()].join("|");
  return hash(raw);
}

export function getDeviceFingerprint(deviceInfo?: LicenseDeviceInfo) {
  return String(deviceInfo?.deviceId || "").trim() || fallbackDeviceId();
}

export function parseLicenseKey(licenseKey: string): LicensePayload {
  const clean = String(licenseKey || "").trim();
  if (clean.startsWith("SOM2-")) return parseShortLicenseKey(clean);
  if (!clean.startsWith("SOM-")) throw new Error("INVALID_LICENSE_FORMAT");
  const body = clean.slice(4);
  const [payloadPart, signature] = body.split(".");
  if (!payloadPart || !signature) throw new Error("INVALID_LICENSE_FORMAT");
  if (hmac(payloadPart) !== signature) throw new Error("INVALID_LICENSE_SIGNATURE");
  const payload = JSON.parse(base64UrlDecode(payloadPart));
  if (!payload.expiresAt || Number.isNaN(new Date(payload.expiresAt).getTime()))
    throw new Error("INVALID_LICENSE_EXPIRY");
  return payload;
}

export async function ensureTrialLicense(schoolId: string) {
  const existing = await prisma.licenseActivation.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const deviceId = fallbackDeviceId();
  const licenseKeyHash = hash(`trial:${schoolId}:${deviceId}`);

  try {
    return await prisma.licenseActivation.upsert({
      where: { licenseKeyHash },
      update: {},
      create: {
        schoolId,
        licenseKeyHash,
        plan: "TRIAL",
        status: "TRIAL",
        expiresAt,
        maxDevices: 1,
        deviceFingerprint: deviceId,
        metadata: { autoCreated: true, trialDays: TRIAL_DAYS }
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const createdByConcurrentRequest = await prisma.licenseActivation.findUnique({ where: { licenseKeyHash } });
    if (createdByConcurrentRequest) return createdByConcurrentRequest;
    throw error;
  }
}

async function getPrimaryLicenseActivation(schoolId: string) {
  const activated = await prisma.licenseActivation.findFirst({
    where: {
      schoolId,
      NOT: { plan: "TRIAL" }
    },
    orderBy: { createdAt: "desc" }
  });
  if (activated) return activated;
  return ensureTrialLicense(schoolId);
}

async function resolveLicenseSchoolId(schoolIdOverride: string | undefined, deviceInfo?: LicenseDeviceInfo) {
  if (schoolIdOverride) return schoolIdOverride;

  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  if (RUNTIME_MODE !== "saas") {
    const deviceActivation = await prisma.licenseActivation.findFirst({
      where: { deviceFingerprint: normalizedDevice.deviceId },
      orderBy: { createdAt: "desc" }
    });
    if (deviceActivation?.schoolId) return deviceActivation.schoolId;
  }

  return getDefaultSchoolId();
}

async function postCentral(path: string, body: unknown): Promise<CentralLicenseResult | null> {
  if (!CENTRAL_LICENSE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CENTRAL_TIMEOUT_MS);
  try {
    const response = await fetch(CENTRAL_LICENSE_URL.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Request-Nonce": crypto.randomBytes(24).toString("hex") },
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

async function checkCentralLicense(
  licenseKeyHash: string,
  deviceInfo: Required<LicenseDeviceInfo>
): Promise<CentralLicenseResult | null> {
  try {
    return await postCentral("/api/client/check", { licenseKeyHash, ...deviceInfo });
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

function shouldUseCentralForLicenseKey(licenseKey: string) {
  const cleanLicense = String(licenseKey || "").trim();
  if (!CENTRAL_LICENSE_URL) return false;
  if (cleanLicense.includes(".")) return false;
  return true;
}

export function shouldFallbackToLocalLicense(central?: CentralLicenseResult | null, runtimeMode = RUNTIME_MODE) {
  if (!central?.error) return false;
  if (central.error !== "LICENSE_NOT_FOUND") return false;
  if (REQUIRE_CENTRAL_LICENSE) return false;
  return (
    String(runtimeMode || "")
      .trim()
      .toLowerCase() !== "saas"
  );
}

export function getLocalFallbackLicenseStatus(status: LicenseStatus) {
  return status === "EXPIRED" || status === "CANCELLED" ? status : "ACTIVE";
}

function normalizeDeviceInfo(deviceInfo?: LicenseDeviceInfo): Required<LicenseDeviceInfo> {
  return {
    deviceId: getDeviceFingerprint(deviceInfo),
    deviceName: String(deviceInfo?.deviceName || os.hostname() || "SOM PRO Desktop"),
    appVersion: String(deviceInfo?.appVersion || "1.5.5"),
    platform: String(deviceInfo?.platform || os.platform())
  };
}

function metadataObject(value: unknown): LicenseMetadata {
  return isRecord(value) ? (value as LicenseMetadata) : {};
}

function buildActivationMetadata(
  payload: LicensePayload,
  device: Required<LicenseDeviceInfo>,
  cleanLicense: string
): LicenseMetadata {
  const licenseSetup: DesktopLicenseSetup = {
    schoolName: payload.schoolName,
    institutionCode: payload.institutionCode,
    licenseCode: cleanLicense,
    plan: payload.plan,
    expiresAt: payload.expiresAt,
    maxDevices: payload.maxDevices
  };
  return {
    ...payload,
    codeType: cleanLicense.includes(".") ? "SIGNED_KEY" : "SHORT_CODE",
    device,
    centralLastSuccessAt: new Date().toISOString(),
    allowedFeatures: payload.allowedFeatures || [],
    licenseCode: cleanLicense,
    licenseSetup,
    licenseSetupSavedAt: new Date().toISOString()
  };
}

function normalizeLicenseSetup(value: unknown): DesktopLicenseSetup | null {
  const parsed = DesktopLicenseSetupSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    schoolName: parsed.data.schoolName?.trim() || undefined,
    institutionCode: parsed.data.institutionCode?.trim() || undefined,
    licenseCode: parsed.data.licenseCode.trim(),
    plan: parsed.data.plan?.trim() || undefined,
    expiresAt: parsed.data.expiresAt?.trim() || undefined,
    maxDevices: typeof parsed.data.maxDevices === "string" ? parsed.data.maxDevices.trim() : parsed.data.maxDevices
  };
}

function licenseSetupFromActivation(activation: {
  schoolName: string | null;
  institutionCode: string | null;
  plan: string;
  expiresAt: Date;
  maxDevices: number;
  metadata: unknown;
}): DesktopLicenseSetup | null {
  const metadata = metadataObject(activation.metadata);
  const saved = normalizeLicenseSetup(metadata.licenseSetup);
  const licenseCode = typeof metadata.licenseCode === "string" ? metadata.licenseCode.trim() : "";

  if (saved) {
    return {
      ...saved,
      licenseCode: saved.licenseCode || licenseCode
    };
  }

  if (!licenseCode) return null;
  return {
    schoolName: activation.schoolName || undefined,
    institutionCode: activation.institutionCode || undefined,
    licenseCode,
    plan: activation.plan || undefined,
    expiresAt: activation.expiresAt.toISOString(),
    maxDevices: activation.maxDevices
  };
}

function buildAdminAccountResult(
  adminAccount: LicensePayload["adminAccount"] | null | undefined,
  fallbackName = DEFAULT_ADMIN_NAME
) {
  if (!adminAccount) return null;
  return {
    name: adminAccount.name || fallbackName,
    email: adminAccount.email,
    password: adminAccount.password
  };
}

export async function activateLicense(licenseKey: string, schoolIdOverride?: string, deviceInfo?: LicenseDeviceInfo) {
  const schoolId = schoolIdOverride || (await getDefaultSchoolId());
  const cleanLicense = String(licenseKey || "").trim();
  if (!cleanLicense) throw new Error("INVALID_LICENSE_FORMAT");

  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const keyHash = getLicenseCredentialHashForStorage(cleanLicense);
  let central: CentralLicenseResult | null = null;
  let payload: LicensePayload;

  if (shouldUseCentralForLicenseKey(cleanLicense) || shouldUseCentralLicenseServer()) {
    central = await postCentral("/api/client/activate", {
      licenseKey: cleanLicense,
      licenseCode: cleanLicense,
      ...normalizedDevice
    });
    if (central?.data?.expiresAt) payload = central.data as LicensePayload;
    else payload = parseLicenseKey(cleanLicense);
  } else {
    payload = parseLicenseKey(cleanLicense);
  }

  const existingOnOtherDevice = await prisma.licenseActivation.findFirst({
    where: { licenseKeyHash: keyHash, NOT: { deviceFingerprint: normalizedDevice.deviceId } }
  });
  if (existingOnOtherDevice) throw new Error("LICENSE_ALREADY_USED_ON_OTHER_DEVICE");

  const metadata = buildActivationMetadata(payload, normalizedDevice, cleanLicense);
  const adminUser = await ensureLicenseAdminAccount(payload.adminAccount, payload, false);

  const activation = await prisma.licenseActivation.upsert({
    where: { licenseKeyHash: keyHash },
    update: {
      status: "ACTIVE",
      schoolName: payload.schoolName,
      institutionCode: payload.institutionCode,
      plan: payload.plan || "PAID",
      expiresAt: new Date(payload.expiresAt),
      maxDevices: payload.maxDevices || 1,
      deviceFingerprint: normalizedDevice.deviceId,
      lastCheckAt: new Date(),
      readOnlyReason: null,
      metadata: metadata as Prisma.InputJsonValue
    },
    create: {
      schoolId,
      licenseKeyHash: keyHash,
      status: "ACTIVE",
      schoolName: payload.schoolName,
      institutionCode: payload.institutionCode,
      plan: payload.plan || "PAID",
      expiresAt: new Date(payload.expiresAt),
      maxDevices: payload.maxDevices || 1,
      deviceFingerprint: normalizedDevice.deviceId,
      metadata: metadata as Prisma.InputJsonValue
    }
  });

  return {
    ...activation,
    adminUser,
    adminAccount: buildAdminAccountResult(payload.adminAccount)
  };
}

export async function getPersistedLicenseSetup(schoolIdOverride?: string) {
  const schoolId = schoolIdOverride || (await getDefaultSchoolId());
  const activation = await getPrimaryLicenseActivation(schoolId);
  return licenseSetupFromActivation(activation);
}

export async function savePersistedLicenseSetup(
  setup: DesktopLicenseSetup,
  schoolIdOverride?: string,
  deviceInfo?: LicenseDeviceInfo
) {
  const schoolId = schoolIdOverride || (await getDefaultSchoolId());
  const activation = await getPrimaryLicenseActivation(schoolId);
  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const cleanSetup = normalizeLicenseSetup(setup);
  if (!cleanSetup) throw new Error("INVALID_LICENSE_SETUP");

  const metadata = metadataObject(activation.metadata);
  const nextMetadata = {
    ...metadata,
    licenseCode: cleanSetup.licenseCode,
    licenseSetup: cleanSetup,
    licenseSetupSavedAt: new Date().toISOString(),
    device: normalizedDevice
  };

  const expiresAt = cleanSetup.expiresAt ? new Date(cleanSetup.expiresAt) : activation.expiresAt;
  await prisma.licenseActivation.update({
    where: { id: activation.id },
    data: {
      schoolName: cleanSetup.schoolName || activation.schoolName,
      institutionCode: cleanSetup.institutionCode || activation.institutionCode,
      plan: cleanSetup.plan || activation.plan,
      maxDevices:
        typeof cleanSetup.maxDevices === "string"
          ? Number(cleanSetup.maxDevices) || activation.maxDevices
          : cleanSetup.maxDevices || activation.maxDevices,
      expiresAt: Number.isNaN(expiresAt.getTime()) ? activation.expiresAt : expiresAt,
      lastCheckAt: new Date(),
      metadata: nextMetadata as Prisma.InputJsonValue
    }
  });

  return cleanSetup;
}

export async function bootstrapLicenseAccess(licenseKey: string, deviceInfo?: LicenseDeviceInfo) {
  return activateLicense(licenseKey, undefined, deviceInfo);
}

export async function recoverLicenseAdminAccess(licenseKey: string, email?: string) {
  const cleanLicense = String(licenseKey || "").trim();
  if (!cleanLicense) throw new Error("INVALID_LICENSE_FORMAT");

  if (!CENTRAL_LICENSE_URL && !shouldUseCentralLicenseServer()) {
    throw new Error("RECOVERY_NOT_AVAILABLE");
  }

  const central = await postCentral("/api/client/recover-admin", {
    licenseKey: cleanLicense,
    licenseCode: cleanLicense,
    email
  });
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

  if (cleanLicense && (shouldUseCentralForLicenseKey(cleanLicense) || shouldUseCentralLicenseServer())) {
    try {
      const central = await postCentral("/api/client/activate", {
        licenseKey: cleanLicense,
        licenseCode: cleanLicense,
        ...normalizedDevice
      });
      const account = central?.data?.adminAccount;
      if (
        account?.email &&
        account?.password &&
        String(account.email).trim().toLowerCase() === cleanEmail &&
        String(account.password) === cleanPassword
      ) {
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

  const activations = await prisma.licenseActivation.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  for (const activation of activations) {
    const central = await checkCentralLicense(activation.licenseKeyHash, normalizedDevice);
    const account = central?.data?.adminAccount;
    if (!account?.email || !account?.password) continue;
    if (String(account.email).trim().toLowerCase() !== cleanEmail) continue;
    if (String(account.password) !== cleanPassword) continue;

    await ensureLicenseAdminAccount(account, central?.data as LicensePayload, true);
    return {
      email: account.email,
      name: account.name || DEFAULT_ADMIN_NAME,
      role: account.role || "ADMIN"
    };
  }

  return null;
}

export async function getLicenseState(schoolIdOverride?: string, deviceInfo?: LicenseDeviceInfo) {
  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const schoolId = await resolveLicenseSchoolId(schoolIdOverride, normalizedDevice);
  const license = await getPrimaryLicenseActivation(schoolId);
  const now = new Date();
  const useCentral = Boolean(CENTRAL_LICENSE_URL) || shouldUseCentralLicenseServer();
  const central = useCentral ? await checkCentralLicense(license.licenseKeyHash, normalizedDevice) : null;
  const centralStatus = central?.status as LicenseStatus | undefined;
  const metadata = metadataObject(license.metadata);
  const centralSucceeded = Boolean(useCentral && central && !central.error);
  const missingRequiredCentral = REQUIRE_CENTRAL_LICENSE && !CENTRAL_LICENSE_URL;
  const fallbackToLocal = shouldFallbackToLocalLicense(central);
  const centralUnavailable = Boolean(
    useCentral && REQUIRE_CENTRAL_LICENSE && central?.error && !centralStatus && !fallbackToLocal
  );
  const centralReadOnlyReason = missingRequiredCentral
    ? REQUIRED_CENTRAL_NOT_CONFIGURED_MESSAGE
    : fallbackToLocal
      ? null
      : central?.message || central?.error || null;
  const centralExpiresAt =
    central?.data?.expiresAt && !Number.isNaN(new Date(central.data.expiresAt).getTime())
      ? new Date(central.data.expiresAt)
      : license.expiresAt;
  const lastSuccessfulCheckAt =
    metadata.centralLastSuccessAt && !Number.isNaN(new Date(metadata.centralLastSuccessAt).getTime())
      ? new Date(metadata.centralLastSuccessAt)
      : license.lastCheckAt;
  const localModeStatus = license.status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
  const policyStatus = useCentral
    ? fallbackToLocal
      ? getLocalFallbackLicenseStatus(license.status)
      : centralStatus || license.status
    : localModeStatus;

  const policy = evaluateLicensePolicy({
    status: policyStatus,
    expiresAt: centralExpiresAt,
    deviceFingerprint: license.deviceFingerprint,
    currentDeviceFingerprint: normalizedDevice.deviceId,
    forceLock: process.env.SOM_PRO_FORCE_LOCK === "true" || missingRequiredCentral,
    centralUnavailable,
    lastSuccessfulCheckAt,
    gracePeriodDays: GRACE_PERIOD_DAYS,
    readOnlyReason: useCentral ? centralReadOnlyReason || license.readOnlyReason : null,
    now
  });

  const { status, readOnly, readOnlyReason, gracePeriodUntil } = policy;

  const nextMetadata = {
    ...metadata,
    device: normalizedDevice,
    ...(centralSucceeded ? { centralLastSuccessAt: now.toISOString() } : {}),
    ...(gracePeriodUntil ? { gracePeriodUntil: gracePeriodUntil.toISOString() } : {})
  };

  await prisma.licenseActivation
    .update({
      where: { id: license.id },
      data: {
        lastCheckAt: now,
        status,
        readOnlyReason,
        expiresAt: centralExpiresAt,
        schoolName: central?.data?.schoolName || license.schoolName,
        institutionCode: central?.data?.institutionCode || license.institutionCode,
        plan: central?.data?.plan || license.plan,
        maxDevices: central?.data?.maxDevices || license.maxDevices,
        metadata: nextMetadata
      }
    })
    .catch(() => null);

  return {
    id: license.id,
    status,
    plan: central?.data?.plan || license.plan,
    expiresAt: centralExpiresAt,
    readOnly,
    readOnlyReason,
    gracePeriodUntil: gracePeriodUntil?.toISOString() || null,
    deviceFingerprint: normalizedDevice.deviceId,
    deviceName: normalizedDevice.deviceName,
    appVersion: normalizedDevice.appVersion,
    platform: normalizedDevice.platform,
    maxDevices: central?.data?.maxDevices || license.maxDevices,
    activeDevicesCount: central?.activeDevicesCount || central?.data?.activeDevicesCount || null,
    schoolName: central?.data?.schoolName || license.schoolName,
    institutionCode: central?.data?.institutionCode || license.institutionCode,
    message: readOnlyReason || central?.message || null,
    serverTime: central?.serverTime || now.toISOString(),
    centralCheckError: central?.error || null
  };
}
