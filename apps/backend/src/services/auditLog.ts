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

export function recordAuditLog(prisma: PrismaClient, input: AuditInput) {
  const before = input.before === undefined ? undefined : (input.before ?? Prisma.JsonNull);
  const after = input.after === undefined ? undefined : (input.after ?? Prisma.JsonNull);

  void prisma.auditLog
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
