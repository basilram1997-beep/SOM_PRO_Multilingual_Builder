import { LicenseStatus, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { evaluateLicensePolicy } from "./licensePolicy";
import { CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, GRACE_PERIOD_DAYS, REQUIRED_CENTRAL_NOT_CONFIGURED_MESSAGE } from "./licenseRuntimeConfig";
import { getLocalFallbackLicenseStatus, shouldFallbackToLocalLicense, shouldUseCentralLicenseServer } from "./licenseRuntimeDecisions";
import { checkCentralLicense } from "./licenseCentralClient";
import { normalizeDeviceInfo, type LicenseDeviceInfo } from "./licenseIdentity";
import {
  getCachedLicenseStateSnapshot,
  getCachedOrCreateLicenseState,
  clearLicenseStateCache,
  shouldRefreshCachedLicenseState,
  licenseStateCacheKey,
  storeLicenseStateSnapshot,
  type LicenseStateSnapshot
} from "./licenseRuntimeCache";
import { getPrimaryLicenseActivation } from "./licenseRepository";
import { resolveLicenseSchoolId } from "./licenseSchoolResolver";

type LicenseStateOptions = {
  allowCentralCheck: boolean;
  refreshCache: boolean;
};

type ResolvedLicenseContext = {
  schoolId: string;
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>;
  activation: Awaited<ReturnType<typeof getPrimaryLicenseActivation>>;
  cacheKey: string;
};

type CentralLicenseContext = {
  useCentral: boolean;
  central: Awaited<ReturnType<typeof checkCentralLicense>> | null;
  centralStatus: LicenseStatus | undefined;
  missingRequiredCentral: boolean;
  fallbackToLocal: boolean;
  centralUnavailable: boolean;
  centralReadOnlyReason: string | null;
  centralExpiresAt: Date;
  lastSuccessfulCheckAt: Date;
  policyStatus: LicenseStatus;
};

function isValidDate(value: unknown) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

async function resolveLicenseContext(schoolIdOverride: string | undefined, deviceInfo: LicenseDeviceInfo | undefined): Promise<ResolvedLicenseContext> {
  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const schoolId = await resolveLicenseSchoolId(schoolIdOverride, normalizedDevice);
  const activation = await getPrimaryLicenseActivation(schoolId);
  const cacheKey = licenseStateCacheKey(schoolId, normalizedDevice.deviceId, activation.updatedAt);
  return { schoolId, normalizedDevice, activation, cacheKey };
}

async function resolveCentralLicenseContext(
  activation: Awaited<ReturnType<typeof getPrimaryLicenseActivation>>,
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>,
  allowCentralCheck: boolean
): Promise<CentralLicenseContext> {
  const useCentral = allowCentralCheck && (Boolean(CENTRAL_LICENSE_URL) || shouldUseCentralLicenseServer());
  const central = useCentral
    ? await checkCentralLicense(CENTRAL_LICENSE_URL, CENTRAL_TIMEOUT_MS, activation.licenseKeyHash, normalizedDevice)
    : null;
  const centralStatus = central?.status as LicenseStatus | undefined;
  const metadata = activation.metadata && typeof activation.metadata === "object" ? (activation.metadata as Record<string, unknown>) : {};
  const fallbackToLocal = shouldFallbackToLocalLicense(central);
  const missingRequiredCentral = Boolean(process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE === "true" && !CENTRAL_LICENSE_URL);
  const centralUnavailable = Boolean(useCentral && process.env.SOM_PRO_REQUIRE_CENTRAL_LICENSE === "true" && central?.error && !centralStatus && !fallbackToLocal);
  const centralReadOnlyReason = missingRequiredCentral
    ? REQUIRED_CENTRAL_NOT_CONFIGURED_MESSAGE
    : fallbackToLocal
      ? null
      : central?.message || central?.error || null;
  const centralExpiresAt =
    isValidDate(central?.data?.expiresAt) ? new Date(String(central?.data?.expiresAt)) : activation.expiresAt;
  const lastSuccessfulCheckAt =
    isValidDate(metadata.centralLastSuccessAt) ? new Date(String(metadata.centralLastSuccessAt)) : activation.lastCheckAt;
  const localModeStatus = activation.status === "EXPIRED" ? "EXPIRED" : "ACTIVE";
  const policyStatus = useCentral
    ? fallbackToLocal
      ? getLocalFallbackLicenseStatus(activation.status as LicenseStatus)
      : centralStatus || (activation.status as LicenseStatus)
    : localModeStatus;

  return {
    useCentral,
    central,
    centralStatus,
    missingRequiredCentral,
    fallbackToLocal,
    centralUnavailable,
    centralReadOnlyReason,
    centralExpiresAt,
    lastSuccessfulCheckAt,
    policyStatus
  };
}

function buildForceLockFlag(centralContext: CentralLicenseContext) {
  return process.env.SOM_PRO_FORCE_LOCK === "true" || centralContext.missingRequiredCentral;
}

function buildLicenseStateMetadata(
  activation: Awaited<ReturnType<typeof getPrimaryLicenseActivation>>,
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>,
  central: Awaited<ReturnType<typeof checkCentralLicense>> | null,
  centralSucceeded: boolean,
  gracePeriodUntil: Date | null
) {
  const metadata = activation.metadata && typeof activation.metadata === "object" ? (activation.metadata as Record<string, unknown>) : {};
  return {
    ...metadata,
    device: normalizedDevice,
    ...(centralSucceeded ? { centralLastSuccessAt: new Date().toISOString() } : {}),
    ...(gracePeriodUntil ? { gracePeriodUntil: gracePeriodUntil.toISOString() } : {}),
    ...(central?.data?.schoolName ? { schoolName: central.data.schoolName } : {})
  };
}

async function persistLicenseStateSnapshot(
  activation: Awaited<ReturnType<typeof getPrimaryLicenseActivation>>,
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>,
  central: Awaited<ReturnType<typeof checkCentralLicense>> | null,
  status: LicenseStatus,
  readOnlyReason: string | null,
  centralExpiresAt: Date,
  metadata: Record<string, unknown>
) {
  await prisma.licenseActivation
    .update({
      where: { id: activation.id },
      data: {
        lastCheckAt: new Date(),
        status,
        readOnlyReason,
        expiresAt: centralExpiresAt,
        schoolName: central?.data?.schoolName || activation.schoolName,
        institutionCode: central?.data?.institutionCode || activation.institutionCode,
        plan: central?.data?.plan || activation.plan,
        maxDevices: central?.data?.maxDevices || activation.maxDevices,
        metadata: metadata as Prisma.InputJsonValue
      }
    })
    .catch(() => null);
}

function buildLicenseStateSnapshot(
  activation: Awaited<ReturnType<typeof getPrimaryLicenseActivation>>,
  normalizedDevice: ReturnType<typeof normalizeDeviceInfo>,
  central: Awaited<ReturnType<typeof checkCentralLicense>> | null,
  status: LicenseStatus,
  readOnly: boolean,
  readOnlyReason: string | null,
  gracePeriodUntil: Date | null,
  centralExpiresAt: Date
): LicenseStateSnapshot {
  return {
    id: activation.id,
    status,
    plan: central?.data?.plan || activation.plan,
    expiresAt: centralExpiresAt,
    readOnly,
    readOnlyReason,
    gracePeriodUntil: gracePeriodUntil?.toISOString() || null,
    deviceFingerprint: normalizedDevice.deviceId,
    deviceName: normalizedDevice.deviceName,
    appVersion: normalizedDevice.appVersion,
    platform: normalizedDevice.platform,
    maxDevices: central?.data?.maxDevices || activation.maxDevices,
    activeDevicesCount: central?.activeDevicesCount || central?.data?.activeDevicesCount || null,
    schoolName: central?.data?.schoolName || activation.schoolName,
    institutionCode: central?.data?.institutionCode || activation.institutionCode,
    message: readOnlyReason || central?.message || null,
    serverTime: central?.serverTime || new Date().toISOString(),
    centralCheckError: central?.error || null
  };
}

async function computeLicenseStateFromContext(
  context: ResolvedLicenseContext,
  options: LicenseStateOptions
): Promise<LicenseStateSnapshot> {
  const { normalizedDevice, activation, cacheKey } = context;
  const now = new Date();
  const centralContext = await resolveCentralLicenseContext(activation, normalizedDevice, options.allowCentralCheck);
  const centralSucceeded = Boolean(centralContext.useCentral && centralContext.central && !centralContext.central.error);

  const policy = evaluateLicensePolicy({
    status: centralContext.policyStatus,
    expiresAt: centralContext.centralExpiresAt,
    deviceFingerprint: activation.deviceFingerprint,
    currentDeviceFingerprint: normalizedDevice.deviceId,
    forceLock: buildForceLockFlag(centralContext),
    centralUnavailable: centralContext.centralUnavailable,
    lastSuccessfulCheckAt: centralContext.lastSuccessfulCheckAt,
    gracePeriodDays: GRACE_PERIOD_DAYS,
    readOnlyReason: centralContext.useCentral ? centralContext.centralReadOnlyReason || activation.readOnlyReason : null,
    now
  });

  const { status, readOnly, readOnlyReason, gracePeriodUntil } = policy;
  const nextMetadata = buildLicenseStateMetadata(activation, normalizedDevice, centralContext.central, centralSucceeded, gracePeriodUntil);

  if (options.allowCentralCheck) {
    await persistLicenseStateSnapshot(activation, normalizedDevice, centralContext.central, status, readOnlyReason, centralContext.centralExpiresAt, nextMetadata);
  }

  if (options.refreshCache) {
    storeLicenseStateSnapshot(
      cacheKey,
      buildLicenseStateSnapshot(
        activation,
        normalizedDevice,
        centralContext.central,
        status,
        readOnly,
        readOnlyReason,
        gracePeriodUntil,
        centralContext.centralExpiresAt
      )
    );
  }

  return buildLicenseStateSnapshot(
    activation,
    normalizedDevice,
    centralContext.central,
    status,
    readOnly,
    readOnlyReason,
    gracePeriodUntil,
    centralContext.centralExpiresAt
  );
}

async function refreshLicenseStateSnapshot(context: ResolvedLicenseContext) {
  clearLicenseStateCache(context.schoolId, context.normalizedDevice.deviceId);
  return computeLicenseStateFromContext(context, { allowCentralCheck: true, refreshCache: true });
}

export async function getLicenseGuardState(schoolIdOverride?: string, deviceInfo?: LicenseDeviceInfo) {
  const context = await resolveLicenseContext(schoolIdOverride, deviceInfo);
  const { cacheKey } = context;
  const cached = getCachedLicenseStateSnapshot(cacheKey);
  if (cached) {
    if (shouldRefreshCachedLicenseState(cacheKey)) {
      void refreshLicenseStateSnapshot(context).catch(() => null);
    }
    return cached;
  }

  const snapshot = await getCachedOrCreateLicenseState(cacheKey, () =>
    computeLicenseStateFromContext(context, { allowCentralCheck: false, refreshCache: true })
  );
  if (shouldRefreshCachedLicenseState(cacheKey)) {
    void refreshLicenseStateSnapshot(context).catch(() => null);
  }
  return snapshot;
}

export async function getLicenseState(schoolIdOverride?: string, deviceInfo?: LicenseDeviceInfo) {
  const context = await resolveLicenseContext(schoolIdOverride, deviceInfo);
  const cached = getCachedLicenseStateSnapshot(context.cacheKey);
  if (cached) {
    if (shouldRefreshCachedLicenseState(context.cacheKey)) {
      void refreshLicenseStateSnapshot(context).catch(() => null);
    }
    return cached;
  }

  return getCachedOrCreateLicenseState(context.cacheKey, () =>
    computeLicenseStateFromContext(context, { allowCentralCheck: true, refreshCache: true })
  );
}
