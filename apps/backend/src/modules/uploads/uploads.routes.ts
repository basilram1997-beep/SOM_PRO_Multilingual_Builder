import { randomUUID } from "node:crypto";
import path from "node:path";
import { promises as fs } from "node:fs";
import express, { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma";
import { scanUploadedFile } from "../../services/fileUploadScanning";
import { recordAuditLog } from "../../services/auditLog";
import { logSafeError } from "../../lib/safeLog";

const uploadRoot = path.join(process.cwd(), "tmp", "uploads");
const maxUploadBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "application/octet-stream",
  "text/plain",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
]);

function sanitizeFileName(fileName: string) {
  const trimmed = String(fileName || "").trim();
  const baseName = path.basename(trimmed).replace(/[^\w.\-()+[\] ]+/gu, "_");
  return baseName.slice(0, 120) || "upload.bin";
}

function getUploadFileName(req: express.Request) {
  const headerName = String(req.headers["x-file-name"] || "").trim();
  return sanitizeFileName(headerName || "upload.bin");
}

function getUploadMimeType(req: express.Request) {
  return String(req.headers["x-mime-type"] || req.headers["content-type"] || "")
    .trim()
    .toLowerCase();
}

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  express.raw({
    type: [
      "application/octet-stream",
      "application/pdf",
      "text/plain",
      "image/png",
      "image/jpeg",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel"
    ],
    limit: "10mb"
  }),
  async (req, res) => {
    try {
      const fileName = getUploadFileName(req);
      const mimeType = getUploadMimeType(req);
      const content = Buffer.isBuffer(req.body) ? req.body : Buffer.from([]);
      const sizeBytes = content.length;

      if (!fileName) {
        return res.status(400).json({ error: "INVALID_FILE_NAME", message: "اسم الملف غير صالح" });
      }

      if (!allowedMimeTypes.has(mimeType)) {
        return res.status(415).json({ error: "UNSUPPORTED_FILE_TYPE", message: "نوع الملف غير مدعوم" });
      }

      if (sizeBytes <= 0) {
        return res.status(400).json({ error: "EMPTY_FILE", message: "الملف فارغ" });
      }

      if (sizeBytes > maxUploadBytes) {
        return res.status(413).json({ error: "FILE_TOO_LARGE", message: "حجم الملف أكبر من الحد المسموح" });
      }

      const scanResult = await scanUploadedFile({
        fileName,
        mimeType,
        sizeBytes,
        content
      });

      if (!scanResult.ok) {
        return res.status(422).json({
          error: "FILE_UPLOAD_REJECTED",
          message: "تعذر قبول الملف بعد الفحص الأمني",
          details: {
            reason: scanResult.reason,
            scanner: scanResult.scanner
          }
        });
      }

      const schoolId = req.user?.schoolId || "unknown";
      const safeSchoolId = schoolId.replace(/[^a-zA-Z0-9_-]+/g, "_");
      const storedName = `${Date.now()}-${randomUUID()}-${fileName}`;
      const relativePath = path.posix.join("uploads", safeSchoolId, storedName);
      const absolutePath = path.join(uploadRoot, safeSchoolId, storedName);

      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content);

      recordAuditLog(prisma, {
        schoolId: req.user?.schoolId || null,
        userId: req.user?.id || req.user?.userId || null,
        action: "FILE UPLOAD",
        entity: "UploadArtifact",
        after: {
          filePath: relativePath,
          fileName,
          mimeType,
          sizeBytes,
          scanner: scanResult.scanner
        } as unknown as Prisma.InputJsonValue
      });

      return res.status(201).json({
        data: {
          ok: true,
          filePath: relativePath,
          fileName,
          mimeType,
          sizeBytes,
          scanner: scanResult.scanner
        }
      });
    } catch (error) {
      logSafeError("uploads.create", error);
      return res.status(500).json({ error: "UPLOAD_FAILED", message: "تعذر حفظ الملف" });
    }
  }
);
