import { LicenseStatus } from "@prisma/client";

export type LicensePolicyInput = {
  status: LicenseStatus;
  expiresAt: Date;
  deviceFingerprint: string;
  currentDeviceFingerprint: string;
  forceLock?: boolean;
  centralUnavailable?: boolean;
  lastSuccessfulCheckAt?: Date | null;
  gracePeriodDays?: number;
  readOnlyReason?: string | null;
  now?: Date;
};

export function evaluateLicensePolicy(input: LicensePolicyInput) {
  const now = input.now || new Date();
  let status = input.status;
  let readOnlyReason = input.readOnlyReason || null;
  let gracePeriodUntil: Date | null = null;
  const gracePeriodDays = input.gracePeriodDays ?? 3;

  if (input.deviceFingerprint !== input.currentDeviceFingerprint) {
    status = "SUSPENDED";
    readOnlyReason = "هذا الترخيص مربوط بجهاز آخر";
  } else if (input.expiresAt.getTime() < now.getTime()) {
    status = "EXPIRED";
    readOnlyReason = "انتهت مدة التجربة أو الترخيص";
  } else if (input.centralUnavailable) {
    const lastCheck = input.lastSuccessfulCheckAt || null;
    gracePeriodUntil = lastCheck ? new Date(lastCheck.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000) : null;
    if (lastCheck && gracePeriodUntil && gracePeriodUntil.getTime() >= now.getTime()) {
      readOnlyReason = `لا يوجد اتصال بخادم الترخيص. يمكنك استخدام البرنامج مؤقتًا حتى ${gracePeriodUntil.toISOString()}`;
    } else {
      status = "SUSPENDED";
      readOnlyReason = "تعذر التحقق من الترخيص. اتصل بالإنترنت لتأكيد الترخيص";
    }
  } else if (input.forceLock) {
    status = "SUSPENDED";
    readOnlyReason = "تم إيقاف الترخيص من مالك البرنامج";
  }

  return {
    status,
    readOnly: status === "READ_ONLY" || status === "SUSPENDED" || status === "EXPIRED" || status === "CANCELLED",
    readOnlyReason,
    gracePeriodUntil
  };
}

export function canWriteWithLicense(state: { readOnly: boolean }) {
  return !state.readOnly;
}
