import { Prisma } from "@prisma/client";
import { DesktopLicenseSetupSchema, type DesktopLicenseSetup } from "@som/shared";
import { prisma } from "../db/prisma";
import type { LicenseDeviceInfo, LicensePayload } from "./licenseIdentity";
import { hash, normalizeDeviceInfo } from "./licenseIdentity";

type LicenseActivationRecord = {
  id: string;
  schoolId: string;
  licenseKeyHash: string;
  schoolName: string | null;
  institutionCode: string | null;
  plan: string;
  status: string;
  expiresAt: Date;
  maxDevices: number;
  deviceFingerprint: string;
  lastCheckAt: Date;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function metadataObject(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

export function normalizeLicenseSetup(value: unknown): DesktopLicenseSetup | null {
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

export function buildActivationMetadata(payload: LicensePayload, device: Required<LicenseDeviceInfo>, cleanLicense: string) {
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

export async function findConflictingLicenseActivation(licenseKeyHash: string, deviceFingerprint: string) {
  return prisma.licenseActivation.findFirst({
    where: { licenseKeyHash, NOT: { deviceFingerprint } }
  });
}

export async function upsertLicenseActivation(input: {
  schoolId: string;
  licenseKeyHash: string;
  payload: LicensePayload;
  device: Required<LicenseDeviceInfo>;
  metadata: Prisma.InputJsonValue;
}) {
  const { schoolId, licenseKeyHash, payload, device, metadata } = input;
  return prisma.licenseActivation.upsert({
    where: { licenseKeyHash },
    update: {
      status: "ACTIVE",
      schoolName: payload.schoolName,
      institutionCode: payload.institutionCode,
      plan: payload.plan || "PAID",
      expiresAt: new Date(payload.expiresAt),
      maxDevices: payload.maxDevices || 1,
      deviceFingerprint: device.deviceId,
      lastCheckAt: new Date(),
      readOnlyReason: null,
      metadata
    },
    create: {
      schoolId,
      licenseKeyHash,
      status: "ACTIVE",
      schoolName: payload.schoolName,
      institutionCode: payload.institutionCode,
      plan: payload.plan || "PAID",
      expiresAt: new Date(payload.expiresAt),
      maxDevices: payload.maxDevices || 1,
      deviceFingerprint: device.deviceId,
      metadata
    }
  });
}

export function licenseSetupFromActivation(activation: Pick<LicenseActivationRecord, "schoolName" | "institutionCode" | "plan" | "expiresAt" | "maxDevices" | "metadata">) {
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

export async function ensureTrialLicense(schoolId: string) {
  const existing = await prisma.licenseActivation.findFirst({
    where: { schoolId },
    orderBy: { createdAt: "desc" }
  });
  if (existing) return existing;

  const expiresAt = new Date(Date.now() + Number(process.env.SOM_PRO_TRIAL_DAYS || 30) * 24 * 60 * 60 * 1000);
  const deviceId = normalizeDeviceInfo().deviceId;
  const licenseKeyHash = hash(`trial:${schoolId}:${deviceId}`);

  try {
    return await prisma.licenseActivation.upsert({
      where: { licenseKeyHash: licenseKeyHash },
      update: {},
      create: {
        schoolId,
        licenseKeyHash,
        plan: "TRIAL",
        status: "TRIAL",
        expiresAt,
        maxDevices: 1,
        deviceFingerprint: deviceId,
        metadata: { autoCreated: true, trialDays: Number(process.env.SOM_PRO_TRIAL_DAYS || 30) }
      }
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const createdByConcurrentRequest = await prisma.licenseActivation.findUnique({ where: { licenseKeyHash } });
    if (createdByConcurrentRequest) return createdByConcurrentRequest;
    throw error;
  }
}

export async function getPrimaryLicenseActivation(schoolId: string) {
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

export async function getPersistedLicenseSetup(schoolId: string) {
  const activation = await getPrimaryLicenseActivation(schoolId);
  return licenseSetupFromActivation(activation);
}

export async function savePersistedLicenseSetup(
  setup: DesktopLicenseSetup,
  schoolId: string,
  deviceInfo?: LicenseDeviceInfo
) {
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
