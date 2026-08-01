import { type PrismaClient } from "@prisma/client";

type ReportExportRecordInput = {
  schoolId: string;
  reportType: string;
  fileType: string;
  filePath: string;
  requestedBy?: string | null;
  status?: string;
  expiresAt?: Date | null;
};

type BackupJobRecordInput = {
  schoolId: string;
  backupType: string;
  filePath: string;
  checksum: string;
  encrypted?: boolean;
  status?: string;
  startedAt?: Date;
  finishedAt?: Date | null;
  createdBy?: string | null;
};

export async function createReportExportRecord(prisma: PrismaClient, input: ReportExportRecordInput) {
  const existing = await prisma.reportExport.findFirst({
    where: {
      schoolId: input.schoolId,
      reportType: input.reportType,
      filePath: input.filePath
    }
  });

  const data = {
    schoolId: input.schoolId,
    reportType: input.reportType,
    fileType: input.fileType,
    filePath: input.filePath,
    requestedBy: input.requestedBy ?? null,
    status: input.status || "REQUESTED",
    expiresAt: input.expiresAt ?? null
  };

  if (existing) {
    return prisma.reportExport.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.reportExport.create({ data });
}

export async function createBackupJobRecord(prisma: PrismaClient, input: BackupJobRecordInput) {
  const existing = await prisma.backupJob.findFirst({
    where: {
      schoolId: input.schoolId,
      backupType: input.backupType,
      filePath: input.filePath
    }
  });

  const data = {
    schoolId: input.schoolId,
    backupType: input.backupType,
    status: input.status || "PENDING",
    filePath: input.filePath,
    checksum: input.checksum,
    encrypted: Boolean(input.encrypted),
    startedAt: input.startedAt,
    finishedAt: input.finishedAt ?? null,
    createdBy: input.createdBy ?? null
  };

  if (existing) {
    return prisma.backupJob.update({
      where: { id: existing.id },
      data
    });
  }

  return prisma.backupJob.create({ data });
}

export async function completeBackupJobRecord(
  prisma: PrismaClient,
  id: string,
  patch: Partial<Pick<BackupJobRecordInput, "status" | "finishedAt" | "checksum" | "filePath" | "encrypted">>
) {
  return prisma.backupJob.update({
    where: { id },
    data: {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.finishedAt !== undefined ? { finishedAt: patch.finishedAt } : {}),
      ...(patch.checksum ? { checksum: patch.checksum } : {}),
      ...(patch.filePath ? { filePath: patch.filePath } : {}),
      ...(patch.encrypted !== undefined ? { encrypted: patch.encrypted } : {})
    }
  });
}
