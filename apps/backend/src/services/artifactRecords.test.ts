import test from "node:test";
import assert from "node:assert/strict";
import { completeBackupJobRecord, createBackupJobRecord, createReportExportRecord } from "./artifactRecords";

function createFakePrisma(existingReport: unknown = null, existingBackup: unknown = null) {
  const calls: string[] = [];
  const captured = {
    report: null as null | { create: unknown; update: unknown },
    backup: null as null | { create: unknown; update: unknown },
    backupUpdate: null as null | { where: { id: string }; data: unknown }
  };
  const prisma = {
    reportExport: {
      async upsert({ create, update }: { create: { filePath: string }; update: { filePath: string } }) {
        calls.push("report.upsert");
        captured.report = { create, update };
        existingReport = existingReport ? { id: "report-updated", ...update } : { id: "report-created", ...create };
        return existingReport as never;
      }
    },
    backupJob: {
      async upsert({ create, update }: { create: { filePath: string }; update: { filePath: string } }) {
        calls.push("backup.upsert");
        captured.backup = { create, update };
        existingBackup = existingBackup ? { id: "backup-updated", ...update } : { id: "backup-created", ...create };
        return existingBackup as never;
      },
      async update({ where, data }: { where: { id: string }; data: unknown }) {
        calls.push("backup.update");
        captured.backupUpdate = { where, data };
        return { id: where.id, ...(data as Record<string, unknown>) } as never;
      }
    }
  };

  return { prisma, calls, captured };
}

test("report export records fill defaults and update the existing row when the same file path is saved again", async () => {
  const first = createFakePrisma();
  const payload = {
    schoolId: "school-a",
    reportType: "attendance",
    fileType: "pdf",
    filePath: "reports/attendance/one.pdf"
  };

  const created = await createReportExportRecord(first.prisma as never, payload);
  assert.equal(first.calls.join(","), "report.upsert");
  assert.equal((created as { filePath: string }).filePath, payload.filePath);
  assert.equal((first.captured.report?.create as { requestedBy: string | null }).requestedBy, null);
  assert.equal((first.captured.report?.create as { status: string }).status, "REQUESTED");
  assert.equal((first.captured.report?.create as { expiresAt: Date | null }).expiresAt, null);

  const second = createFakePrisma({ id: "report-existing" }, null);
  const updated = await createReportExportRecord(second.prisma as never, payload);
  assert.equal(second.calls.join(","), "report.upsert");
  assert.equal((updated as { filePath: string }).filePath, payload.filePath);
  assert.equal((second.captured.report?.update as { requestedBy: string | null }).requestedBy, null);
  assert.equal((second.captured.report?.update as { status: string }).status, "REQUESTED");
});

test("backup job records fill defaults, update the existing row, and support partial completion patches", async () => {
  const first = createFakePrisma();
  const payload = {
    schoolId: "school-a",
    backupType: "SCHOOL_EXPORT_SNAPSHOT",
    filePath: "backups/schools/school-a/export.json",
    checksum: "abc123",
    startedAt: new Date("2026-07-20T00:00:00.000Z")
  };

  const created = await createBackupJobRecord(first.prisma as never, payload);
  assert.equal(first.calls.join(","), "backup.upsert");
  assert.equal((created as { filePath: string }).filePath, payload.filePath);
  assert.equal((first.captured.backup?.create as { status: string }).status, "PENDING");
  assert.equal((first.captured.backup?.create as { encrypted: boolean }).encrypted, false);
  assert.equal((first.captured.backup?.create as { createdBy: string | null }).createdBy, null);

  const second = createFakePrisma(null, { id: "backup-existing" });
  const updated = await createBackupJobRecord(second.prisma as never, payload);
  assert.equal(second.calls.join(","), "backup.upsert");
  assert.equal((updated as { filePath: string }).filePath, payload.filePath);
  assert.equal((second.captured.backup?.update as { status: string }).status, "PENDING");

  const patched = await completeBackupJobRecord(second.prisma as never, "backup-existing", {
    status: "ARCHIVED",
    checksum: "checksum-2",
    encrypted: false
  });
  assert.equal(second.calls.at(-1), "backup.update");
  assert.equal((patched as { id: string }).id, "backup-existing");
  assert.deepEqual(second.captured.backupUpdate, {
    where: { id: "backup-existing" },
    data: {
      status: "ARCHIVED",
      checksum: "checksum-2",
      encrypted: false
    }
  });
});
