import crypto from "node:crypto";
import os from "node:os";
import { LicenseStatus, UserRole } from "@prisma/client";

const DEFAULT_LICENSE_SECRET = "change-this-secret-before-selling";
const OWNER_SECRET = process.env.SOM_PRO_LICENSE_SECRET || DEFAULT_LICENSE_SECRET;

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

function assertLicenseSecretConfigured() {
  if (process.env.NODE_ENV === "production" && OWNER_SECRET === DEFAULT_LICENSE_SECRET) {
    throw new Error("SOM_PRO_LICENSE_SECRET must be changed before selling or production use");
  }
}

export function hash(value: string) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

export function normalizeLicenseCode(value: string) {
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

export function normalizeDeviceInfo(deviceInfo?: LicenseDeviceInfo): Required<LicenseDeviceInfo> {
  return {
    deviceId: getDeviceFingerprint(deviceInfo),
    deviceName: String(deviceInfo?.deviceName || os.hostname() || "SOM PRO Desktop"),
    appVersion: String(deviceInfo?.appVersion || "1.5.5"),
    platform: String(deviceInfo?.platform || os.platform())
  };
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
  if (!payload.expiresAt || Number.isNaN(new Date(payload.expiresAt).getTime())) {
    throw new Error("INVALID_LICENSE_EXPIRY");
  }
  return payload;
}
