import type { Request } from "express";
import type { LicenseDeviceInfo } from "./licenseService";

export function getRequestDeviceInfo(req: Request): LicenseDeviceInfo {
  return {
    deviceId: String(req.body?.deviceId || req.headers["x-som-device-id"] || ""),
    deviceName: String(req.body?.deviceName || req.headers["x-som-device-name"] || ""),
    appVersion: String(req.body?.appVersion || req.headers["x-som-app-version"] || ""),
    platform: String(req.body?.platform || req.headers["x-som-platform"] || "")
  };
}
