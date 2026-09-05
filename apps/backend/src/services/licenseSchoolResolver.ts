import { prisma } from "../db/prisma";
import { getDefaultSchoolId } from "./schoolContext";
import type { LicenseDeviceInfo } from "./licenseIdentity";
import { normalizeDeviceInfo } from "./licenseIdentity";

export async function resolveLicenseSchoolId(schoolIdOverride: string | undefined, deviceInfo?: LicenseDeviceInfo) {
  if (schoolIdOverride) return schoolIdOverride;
  const normalizedDevice = normalizeDeviceInfo(deviceInfo);
  const runtimeMode = String(process.env.SOM_RUNTIME_MODE || process.env.NODE_ENV || "development").trim().toLowerCase();
  if (runtimeMode !== "saas") {
    const deviceActivation = await prisma.licenseActivation.findFirst({
      where: { deviceFingerprint: normalizedDevice.deviceId },
      orderBy: { createdAt: "desc" }
    });
    if (deviceActivation?.schoolId) return deviceActivation.schoolId;
  }
  return getDefaultSchoolId();
}
