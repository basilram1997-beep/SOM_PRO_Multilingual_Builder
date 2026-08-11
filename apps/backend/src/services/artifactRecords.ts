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
  const data = {
    schoolId: input.schoolId,
    reportType: input.reportType,
    fileType: input.fileType,
    filePath: input.filePath,
    requestedBy: input.requestedBy ?? null,
    status: input.status || "REQUESTED",
    expiresAt: input.expiresAt ?? null
  };

  return prisma.reportExport.upsert({
    where: {
      schoolId_filePath: {
        schoolId: input.schoolId,
        filePath: input.filePath
      }
    },
    create: data,
    update: data
  });
}

export async function createBackupJobRecord(prisma: PrismaClient, input: BackupJobRecordInput) {
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

  return prisma.backupJob.upsert({
    where: {
      schoolId_filePath: {
        schoolId: input.schoolId,
        filePath: input.filePath
      }
    },
    create: data,
    update: data
  });
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
