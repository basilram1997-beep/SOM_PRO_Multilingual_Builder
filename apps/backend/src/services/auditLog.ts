import { Prisma, type PrismaClient } from "@prisma/client";

type AuditInput = {
  schoolId?: string | null;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

const sensitiveAuditKeys = new Set([
  "authorization",
  "authtoken",
  "currentpassword",
  "licensecode",
  "licensekey",
  "mfacode",
  "mfa_secret",
  "mfasecret",
  "mfaSecretEncrypted",
  "newpassword",
  "oldpassword",
  "ownertoken",
  "password",
  "passwordconfirm",
  "passwordconfirmation",
  "recoverycode",
  "recoverycodes",
  "secret",
  "token",
  "tokenversion"
].map((key) => key.toLowerCase()));

export function redactSensitiveAuditValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return `[BUFFER ${value.length} BYTES]`;
  }
  if (Array.isArray(value)) return value.map(redactSensitiveAuditValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveAuditKeys.has(key.toLowerCase()) ? "[REDACTED]" : redactSensitiveAuditValue(item)
    ])
  );
}

export function recordAuditLog(prisma: PrismaClient, input: AuditInput) {
  const before =
    input.before === undefined
      ? undefined
      : ((redactSensitiveAuditValue(input.before) ?? Prisma.JsonNull) as Prisma.InputJsonValue);
  const after =
    input.after === undefined
      ? undefined
      : ((redactSensitiveAuditValue(input.after) ?? Prisma.JsonNull) as Prisma.InputJsonValue);

  return prisma.auditLog
    .create({
      data: {
        schoolId: input.schoolId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before,
        after
      }
    })
    .catch(() => null);
}
