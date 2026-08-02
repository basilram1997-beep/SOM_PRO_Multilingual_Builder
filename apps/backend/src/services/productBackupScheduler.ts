import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { logSafeError } from "../lib/safeLog";
import { recordAuditLog } from "./auditLog";
import { completeBackupJobRecord, createBackupJobRecord } from "./artifactRecords";
import { createProductBackup } from "./productBackup";

let schedulerStarted = false;
let schedulerRunning = false;

function readIntervalMs() {
  const hours = Number(process.env.SOM_AUTO_BACKUP_INTERVAL_HOURS || "0");
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }
  return Math.max(Math.round(hours * 60 * 60 * 1000), 60 * 60 * 1000);
}

async function findBackupSchoolId() {
  const school = await prisma.school.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return school?.id || null;
}

async function runScheduledBackup() {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;
  try {
    const schoolId = await findBackupSchoolId();
    if (!schoolId) {
      return;
    }

    const startedAt = new Date();
    const backupJob = await createBackupJobRecord(prisma, {
      schoolId,
      backupType: "PRODUCT_SCHEDULED",
      status: "PENDING",
      filePath: `deploy/backup/product/scheduled-pending-${startedAt.toISOString().replace(/[:.]/g, "-")}`,
      checksum: "pending",
      encrypted: false,
      startedAt,
      finishedAt: null,
      createdBy: null
    });

    try {
      const result = await createProductBackup({ schoolId, createdBy: null });
      const completed = await completeBackupJobRecord(prisma, backupJob.id, {
        status: "COMPLETED",
        finishedAt: new Date(),
        checksum: result.checksum,
        filePath: result.backupDir,
        encrypted: false
      });

      recordAuditLog(prisma, {
        schoolId,
        userId: null,
        action: "PRODUCT_SCHEDULED_BACKUP_CREATED",
        entity: "BackupJob",
        entityId: completed.id,
        after: {
          backupType: completed.backupType,
          filePath: completed.filePath,
          checksum: completed.checksum,
          licenseDataCopied: result.licenseDataCopied
        } as Prisma.InputJsonValue
      });
    } catch (error) {
      logSafeError("productBackupScheduler.run", error);
      const failed = await completeBackupJobRecord(prisma, backupJob.id, {
        status: "FAILED",
        finishedAt: new Date(),
        checksum: "failed"
      });

      recordAuditLog(prisma, {
        schoolId,
        userId: null,
        action: "PRODUCT_SCHEDULED_BACKUP_FAILED",
        entity: "BackupJob",
        entityId: failed.id,
        after: {
          backupType: failed.backupType,
          filePath: failed.filePath,
          status: failed.status
        } as Prisma.InputJsonValue
      });
    }
  } catch (error) {
    logSafeError("productBackupScheduler.bootstrap", error);
  } finally {
    schedulerRunning = false;
  }
}

export function startProductBackupScheduler() {
  const intervalMs = readIntervalMs();
  if (schedulerStarted || intervalMs <= 0) {
    return;
  }

  schedulerStarted = true;
  setInterval(() => {
    void runScheduledBackup();
  }, intervalMs).unref?.();

  if (process.env.SOM_AUTO_BACKUP_RUN_ON_START === "true") {
    setTimeout(() => {
      void runScheduledBackup();
    }, 10_000).unref?.();
  }
}
