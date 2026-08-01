import test from "node:test";
import assert from "node:assert/strict";
import { createBackupJobRecord, createReportExportRecord } from "./artifactRecords";

function createFakePrisma(existingReport: unknown = null, existingBackup: unknown = null) {
  const calls: string[] = [];
  const prisma = {
    reportExport: {
      async findFirst() {
        calls.push("report.findFirst");
        return existingReport as never;
      },
      async create({ data }: { data: { filePath: string } }) {
        calls.push("report.create");
        existingReport = { id: "report-created", ...data };
        return existingReport as never;
      },
      async update({ data }: { where: { id: string }; data: { filePath: string } }) {
        calls.push("report.update");
        existingReport = { id: "report-updated", ...data };
        return existingReport as never;
      }
    },
    backupJob: {
      async findFirst() {
        calls.push("backup.findFirst");
        return existingBackup as never;
      },
      async create({ data }: { data: { filePath: string } }) {
        calls.push("backup.create");
        existingBackup = { id: "backup-created", ...data };
        return existingBackup as never;
      },
      async update({ data }: { where: { id: string }; data: { filePath: string } }) {
        calls.push("backup.update");
        existingBackup = { id: "backup-updated", ...data };
        return existingBackup as never;
      }
    }
  };

  return { prisma, calls };
}

test("report export records update the existing row when the same file path is saved again", async () => {
  const first = createFakePrisma();
  const payload = {
    schoolId: "school-a",
    reportType: "attendance",
    fileType: "pdf",
    filePath: "reports/attendance/one.pdf",
    requestedBy: "user-a",
    status: "REQUESTED",
    expiresAt: new Date("2026-07-20T00:00:00.000Z")
  };

  const created = await createReportExportRecord(first.prisma as never, payload);
  assert.equal(first.calls.join(","), "report.findFirst,report.create");
  assert.equal((created as { filePath: string }).filePath, payload.filePath);

  const second = createFakePrisma({ id: "report-existing" }, null);
  const updated = await createReportExportRecord(second.prisma as never, payload);
  assert.equal(second.calls.join(","), "report.findFirst,report.update");
  assert.equal((updated as { filePath: string }).filePath, payload.filePath);
});

test("backup job records update the existing row when the same file path is saved again", async () => {
  const first = createFakePrisma();
  const payload = {
    schoolId: "school-a",
    backupType: "SCHOOL_EXPORT_SNAPSHOT",
    filePath: "backups/schools/school-a/export.json",
    checksum: "abc123",
    encrypted: true,
    status: "COMPLETED",
    startedAt: new Date("2026-07-20T00:00:00.000Z"),
    finishedAt: new Date("2026-07-20T00:05:00.000Z"),
    createdBy: "user-a"
  };

  const created = await createBackupJobRecord(first.prisma as never, payload);
  assert.equal(first.calls.join(","), "backup.findFirst,backup.create");
  assert.equal((created as { filePath: string }).filePath, payload.filePath);

  const second = createFakePrisma(null, { id: "backup-existing" });
  const updated = await createBackupJobRecord(second.prisma as never, payload);
  assert.equal(second.calls.join(","), "backup.findFirst,backup.update");
  assert.equal((updated as { filePath: string }).filePath, payload.filePath);
});
