export type LicenseStateSnapshot = {
  id: string;
  status: string;
  plan: string | undefined;
  expiresAt: Date;
  readOnly: boolean;
  readOnlyReason: string | null;
  gracePeriodUntil: string | null;
  deviceFingerprint: string;
  deviceName: string;
  appVersion: string;
  platform: string;
  maxDevices: number;
  activeDevicesCount: number | null;
  schoolName: string | null;
  institutionCode: string | null;
  message: string | null;
  serverTime: string;
  centralCheckError: string | null;
};

const LICENSE_STATE_CACHE_TTL_MS = Number(process.env.SOM_PRO_LICENSE_STATE_CACHE_TTL_MS || 15_000);
const licenseStateCache = new Map<string, { expiresAtMs: number; value: LicenseStateSnapshot }>();
const inFlightLicenseStateChecks = new Map<string, Promise<LicenseStateSnapshot>>();
const licenseStateRefreshMarks = new Map<string, number>();

export { LICENSE_STATE_CACHE_TTL_MS };

export function licenseStateCacheKey(schoolId: string, deviceId: string, activationUpdatedAt: Date | string) {
  const updatedAtMs = new Date(activationUpdatedAt).getTime();
  return `${schoolId}::${deviceId}::${updatedAtMs}`;
}

export function getCachedLicenseStateSnapshot(key: string) {
  const cached = licenseStateCache.get(key);
  if (!cached) return null;
  if (cached.expiresAtMs <= Date.now()) {
    licenseStateCache.delete(key);
    return null;
  }
  return cached.value;
}

export function storeLicenseStateSnapshot(key: string, value: LicenseStateSnapshot) {
  licenseStateCache.set(key, {
    value,
    expiresAtMs: Date.now() + LICENSE_STATE_CACHE_TTL_MS
  });
}

export function clearLicenseStateCache(schoolId?: string, deviceId?: string) {
  if (!schoolId && !deviceId) {
    licenseStateCache.clear();
    inFlightLicenseStateChecks.clear();
    licenseStateRefreshMarks.clear();
    return;
  }

  for (const key of Array.from(licenseStateCache.keys())) {
    const [entrySchoolId, entryDeviceId] = key.split("::", 3);
    const matchesSchool = !schoolId || entrySchoolId === schoolId;
    const matchesDevice = !deviceId || entryDeviceId === deviceId;
    if (matchesSchool && matchesDevice) {
      licenseStateCache.delete(key);
    }
  }

  for (const key of Array.from(inFlightLicenseStateChecks.keys())) {
    const [entrySchoolId, entryDeviceId] = key.split("::", 3);
    const matchesSchool = !schoolId || entrySchoolId === schoolId;
    const matchesDevice = !deviceId || entryDeviceId === deviceId;
    if (matchesSchool && matchesDevice) {
      inFlightLicenseStateChecks.delete(key);
    }
  }

  for (const key of Array.from(licenseStateRefreshMarks.keys())) {
    const [entrySchoolId, entryDeviceId] = key.split("::", 3);
    const matchesSchool = !schoolId || entrySchoolId === schoolId;
    const matchesDevice = !deviceId || entryDeviceId === deviceId;
    if (matchesSchool && matchesDevice) {
      licenseStateRefreshMarks.delete(key);
    }
  }
}

export async function getCachedOrCreateLicenseState(
  key: string,
  creator: () => Promise<LicenseStateSnapshot>
): Promise<LicenseStateSnapshot> {
  const cached = getCachedLicenseStateSnapshot(key);
  if (cached) return cached;

  const inFlight = inFlightLicenseStateChecks.get(key);
  if (inFlight) return inFlight;

  const statePromise = (async () => {
    const value = await creator();
    storeLicenseStateSnapshot(key, value);
    return value;
  })();

  inFlightLicenseStateChecks.set(key, statePromise);
  try {
    return await statePromise;
  } finally {
    inFlightLicenseStateChecks.delete(key);
  }
}

export function shouldRefreshCachedLicenseState(key: string, minimumIntervalMs = Math.min(LICENSE_STATE_CACHE_TTL_MS, 5_000)) {
  const now = Date.now();
  const lastRefreshAt = licenseStateRefreshMarks.get(key) || 0;
  if (now - lastRefreshAt < minimumIntervalMs) {
    return false;
  }

  licenseStateRefreshMarks.set(key, now);
  return true;
}
